"use client";
import AccountDetail from "@/pages-legacy/AccountDetail/AccountDetail";
import { RequireEmailVerification } from "@/components/ui";

export default function Page() {
	return (
		<RequireEmailVerification>
			<AccountDetail />
		</RequireEmailVerification>
	);
}


