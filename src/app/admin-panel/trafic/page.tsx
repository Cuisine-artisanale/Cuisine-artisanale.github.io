"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import {
	EVENT_LABELS,
	LANDING_PAGES,
	PAGE_LABELS,
	SOURCE_LABELS,
	TRAFFIC_SOURCES,
	type TrafficEvent,
} from '@/lib/analytics/traffic';
import '../dashboard.css';
import './trafic.css';

type Counts = Record<string, number>;

interface DayStats {
	date: string;
	visits: Counts;
	landings: Counts;
	events: Partial<Record<TrafficEvent, Counts>>;
}

const PERIODS = [7, 30, 90] as const;
const EVENTS: TrafficEvent[] = ['signup', 'import_analyzed', 'import_saved', 'pin_click'];

const sum = (counts: Counts | undefined) => Object.values(counts ?? {}).reduce((total, n) => total + (Number(n) || 0), 0);
const fmt = (n: number) => n.toLocaleString('fr-FR');

/** Ajoute les compteurs de `from` à `into` */
function addInto(into: Counts, from: Counts | undefined) {
	for (const [key, value] of Object.entries(from ?? {})) into[key] = (into[key] || 0) + (Number(value) || 0);
}

/**
 * Trafic : d'où viennent les visiteurs (canal d'arrivée), sur quelles pages ils arrivent,
 * et ce qu'ils font ensuite (inscriptions, imports), selon le canal de leur première visite.
 */
export default function TraficPage() {
	const [days, setDays] = useState<DayStats[]>([]);
	const [period, setPeriod] = useState<(typeof PERIODS)[number]>(30);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				// Documents nommés par jour ("2026-10-14") : les 90 derniers suffisent pour toutes les périodes
				const snapshot = await getDocs(query(collection(db, 'trafficStats'), orderBy('date', 'desc'), limit(90)));
				if (cancelled) return;
				setDays(
					snapshot.docs.map((doc) => {
						const data = doc.data();
						return { date: data.date || doc.id, visits: data.visits || {}, landings: data.landings || {}, events: data.events || {} };
					})
				);
			} catch (err) {
				console.error('Statistiques de trafic indisponibles :', err);
				if (!cancelled) setError('Impossible de charger les statistiques (règles Firestore déployées ?)');
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => { cancelled = true; };
	}, []);

	const stats = useMemo(() => {
		const since = new Date();
		since.setDate(since.getDate() - (period - 1));
		const sinceKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(since);
		const selected = days.filter((day) => day.date >= sinceKey);

		const visits: Counts = {};
		const landings: Counts = {};
		const events = Object.fromEntries(EVENTS.map((event) => [event, {} as Counts])) as Record<TrafficEvent, Counts>;
		for (const day of selected) {
			addInto(visits, day.visits);
			addInto(landings, day.landings);
			for (const event of EVENTS) addInto(events[event], day.events[event]);
		}

		// Canaux présents dans la période, du plus au moins fréquenté
		const sources = TRAFFIC_SOURCES.filter((source) => visits[source] || EVENTS.some((event) => events[event][source]))
			.sort((a, b) => (visits[b] || 0) - (visits[a] || 0));
		const pages = LANDING_PAGES.filter((page) => landings[page]).sort((a, b) => landings[b] - landings[a]);

		return { visits, landings, events, sources, pages, totalVisits: sum(visits) };
	}, [days, period]);

	const figures = [
		{ icon: 'pi-eye', label: 'Visites', value: stats.totalVisits },
		{ icon: 'pi-user-plus', label: EVENT_LABELS.signup, value: sum(stats.events.signup) },
		{ icon: 'pi-video', label: EVENT_LABELS.import_saved, value: sum(stats.events.import_saved) },
		{ icon: 'pi-bookmark', label: EVENT_LABELS.pin_click, value: sum(stats.events.pin_click) },
	];

	return (
		<div className="admin-dashboard">
			<header className="admin-page-header">
				<div>
					<h1>Trafic</h1>
					<p>D&apos;où viennent les visiteurs, et ce qu&apos;ils font ensuite. Mesure anonyme, sans cookie.</p>
				</div>
				<div className="trafic-periods" role="group" aria-label="Période">
					{PERIODS.map((p) => (
						<button
							key={p}
							type="button"
							className={`trafic-period${period === p ? ' is-active' : ''}`}
							aria-pressed={period === p}
							onClick={() => setPeriod(p)}
						>
							{p} jours
						</button>
					))}
				</div>
			</header>

			{error && <p className="dashboard-empty">{error}</p>}

			{loading ? (
				<p className="dashboard-empty">Chargement…</p>
			) : !error && stats.totalVisits === 0 && stats.sources.length === 0 ? (
				<p className="dashboard-empty">
					<span className="pi pi-info-circle" aria-hidden="true"></span>
					Aucune donnée sur la période : les visites sont comptées depuis la mise en ligne de la mesure.
				</p>
			) : (
				<>
					<div className="dashboard-figures">
						{figures.map((figure) => (
							<div key={figure.label} className="dashboard-figure">
								<span className={`pi ${figure.icon}`} aria-hidden="true"></span>
								<span className="dashboard-figure-value">{fmt(figure.value)}</span>
								<span className="dashboard-figure-label">{figure.label}</span>
							</div>
						))}
					</div>

					<section aria-labelledby="trafic-sources">
						<h2 id="trafic-sources">Par canal</h2>
						<p className="trafic-help">
							Visites : arrivées sur le site depuis ce canal. Les autres colonnes sont rattachées au canal de la
							première visite de la personne, même si elle est revenue plus tard par un autre chemin.
						</p>
						<div className="table-container">
							<table>
								<thead>
									<tr>
										<th>Canal</th>
										<th>Visites</th>
										<th>Part</th>
										{EVENTS.map((event) => <th key={event}>{EVENT_LABELS[event]}</th>)}
									</tr>
								</thead>
								<tbody>
									{stats.sources.map((source) => (
										<tr key={source}>
											<td>{SOURCE_LABELS[source]}</td>
											<td>{fmt(stats.visits[source] || 0)}</td>
											<td>
												{stats.totalVisits
													? `${Math.round(((stats.visits[source] || 0) / stats.totalVisits) * 100)} %`
													: '–'}
											</td>
											{EVENTS.map((event) => <td key={event}>{fmt(stats.events[event][source] || 0)}</td>)}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>

					<section aria-labelledby="trafic-pages">
						<h2 id="trafic-pages">Pages d&apos;arrivée</h2>
						<div className="table-container">
							<table>
								<thead>
									<tr>
										<th>Type de page</th>
										<th>Arrivées</th>
										<th>Part</th>
									</tr>
								</thead>
								<tbody>
									{stats.pages.map((page) => (
										<tr key={page}>
											<td>{PAGE_LABELS[page]}</td>
											<td>{fmt(stats.landings[page])}</td>
											<td>{stats.totalVisits ? `${Math.round((stats.landings[page] / stats.totalVisits) * 100)} %` : '–'}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</>
			)}
		</div>
	);
}
