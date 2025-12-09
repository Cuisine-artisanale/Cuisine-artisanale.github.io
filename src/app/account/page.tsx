"use client";
import AccountDetail from "@/pages-legacy/AccountDetail/AccountDetail";
import RequireEmailVerification from "@/components/RequireEmailVerification/RequireEmailVerification";

export default function Page() {
	return (
		<RequireEmailVerification>
			<AccountDetail />
		</RequireEmailVerification>
	);
}


