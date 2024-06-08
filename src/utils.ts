import semverRegex from "semver-regex";
import kleur from "kleur";
import { Endpoints } from "@octokit/types";
import unzipper from "unzipper";
import latestVersion from "latest-version";
import terminalLink from "terminal-link";

export const extractSemverFromString = (str: string) => {
	const semverArray = str
		.replace("@", " ")
		.replace(/"/g, " ")
		.replace(/,/g, " ")
		.match(semverRegex());

	return semverArray;
};

export const getUnsuccessfulJobs = (
	jobs: Endpoints["GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs"]["response"]["data"]["jobs"],
) => {
	return jobs.filter(
		(job) => job.conclusion !== "success" && job.conclusion !== "skipped",
	);
};

export const getMessageForUnsuccessfulJobs = (
	unsuccessfulJobs: Endpoints["GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs"]["response"]["data"]["jobs"],
) =>
	`${unsuccessfulJobs.length} jobs failed:\n${unsuccessfulJobs.map((job) => `- (${job.conclusion}) ${job.name}\n 📃 ${terminalLink(job.html_url!, job.html_url!)}`).join("\n")}`;

export const getMessageForWorkflowRun = (
	logPrefix: string,
	unsuccessfulJobs: Endpoints["GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs"]["response"]["data"]["jobs"],
	workflowRun: Endpoints["GET /repos/{owner}/{repo}/actions/runs"]["response"]["data"]["workflow_runs"][0],
) =>
	`❌ ${logPrefix} The latest run ${kleur.italic(workflowRun.display_title!)}) conclusion is ${workflowRun.conclusion}.\nSee ${terminalLink("latest run", workflowRun.html_url)} -> ${getMessageForUnsuccessfulJobs(unsuccessfulJobs)}`;

export const getOutputFile = async (data: ArrayBuffer) => {
	const directory = await unzipper.Open.buffer(Buffer.from(data));
	const outputLogFile = directory.files.find((file: any) =>
		file.path.endsWith("output.txt"),
	);

	if (!outputLogFile) {
		throw new Error("❌ ${logPrefix} could not find ...output.txt in the logs");
	}

	const textBuffer = await outputLogFile.buffer();
	return textBuffer.toString();
};

export async function getVersion(ctx: any, tag: string): Promise<string> {
	const prismaPackages = [
		"prisma",
		"@prisma/client",
		"@prisma/migrate",
		"@prisma/internals",
		"@prisma/generator-helper",
		"@prisma/debug",
		"@prisma/get-platform",
		"@prisma/fetch-engine",
		"@prisma/engines",
		"@prisma/instrumentation",
		"@prisma/driver-adapter-utils",
		"@prisma/adapter-d1",
		"@prisma/adapter-libsql",
		"@prisma/adapter-neon",
		"@prisma/adapter-pg",
		"@prisma/adapter-planetscale",
		"@prisma/adapter-pg-worker",
		"@prisma/pg-worker",
	];

	try {
		const options = tag ? { version: tag } : {};
		const versions: Record<string, string> = Object.fromEntries(
			await Promise.all(
				prismaPackages.map((prismaPackage) => {
					return (async () => [
						prismaPackage,
						await latestVersion(prismaPackage, options),
					])();
				}),
			),
		);

		const values = Object.values(versions);
		// Check that all versions are equal
		if (new Set(values).size !== 1) {
			throw new Error(
				`❌ Error: The versions of the Prisma packages are not the same:\n${JSON.stringify(versions, null, 2)}`,
			);
		}

		return values[0];
	} catch (e: unknown) {
		throw new Error(`❌ Error in getVersion(): ${e}`);
	}
}
