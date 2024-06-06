import { Octokit } from "octokit";

export interface Ctx {
	versionLatest: string;
	versionDev: string;
	octokit: Octokit;
}
