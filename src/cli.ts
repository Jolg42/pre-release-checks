import { Listr } from "listr2";
import terminalLink from "terminal-link";
import { getGitHubAuthToken } from "get-github-auth-token";
import { Octokit } from "octokit";
import { retry } from "@octokit/plugin-retry";
import semver from "semver";
import kleur from "kleur";
import {
	extractSemverFromString,
	getUnsuccessfulJobs,
	getMessageForWorkflowRun,
	getOutputFile,
	getVersion,
} from "./utils.js";
import { SERVICES_STATUS } from "./constants.js";
import { Ctx } from "./types.js";

export const runChecks = async () => {
	// Manually enable kleur
	// kleur.enabled = true;

	console.info(
		kleur.italic(
			`Running checks... based on ${terminalLink("Notion document", "https://www.notion.so/prismaio/Prisma-ORM-Code-Release-Process-88cb8e87e1ab4358bb8ff77c70a5e330")}\n`,
		),
	);
	console.warn(
		kleur
			.bold()
			.yellow(
				"⚠️ This script is still in development and does not yet cover all checks.\n",
			),
	);

	// Default owner and repo
	const owner = "prisma";
	const repo = "prisma";

	// structuring as nested tasks to avoid bug with task.title causing duplicates
	const tasks = new Listr<Ctx>(
		[
			{
				title: "Checking version of Prisma ORM packages on npm (latest)",
				task: async (ctx, task) => {
					ctx.versionLatest = await getVersion(ctx, "latest");
					task.title = `Prisma ORM packages on npm (latest): ${kleur.bold(ctx.versionLatest)}`;
				},
			},
			{
				title: "Checking version of Prisma CLI on npm (dev)",
				task: async (ctx, task) => {
					ctx.versionDev = await getVersion(ctx, "dev");
					task.title = `Prisma ORM packages on npm (dev): ${kleur.bold(ctx.versionDev)}`;
				},
			},
			{
				title: "Checking npm status",
				task: async (_, task) => {
					const data = await fetch(SERVICES_STATUS.npm.json).then((res) =>
						res.json(),
					);
					if (data.status.indicator == "none") {
						task.title = `npm status: ✅ ${terminalLink("(Status page)", SERVICES_STATUS.npm.html)}`;
					} else {
						task.title = `npm status: ${data.status.description} (indicator = "${data.status.indicator}") -> ${terminalLink("Status page", SERVICES_STATUS.npm.html)}`;
					}
				},
			},
			{
				title: "Checking GitHub status",
				task: async (_, task) => {
					const data = await fetch(SERVICES_STATUS.github.json).then((res) =>
						res.json(),
					);
					if (data.status.indicator == "none") {
						task.title = `GitHub status: ✅ ${terminalLink("(Status page)", SERVICES_STATUS.github.html)}`;
					} else {
						task.title = `GitHub status: ${data.status.description} (indicator = "${data.status.indicator}") -> ${terminalLink("Status page", SERVICES_STATUS.github.html)}`;
					}
				},
			},
			{
				title: "Check GitHub Actions workflows",
				task: (ctx, parentTask): Listr =>
					parentTask.newListr<Ctx>(
						[
							{
								title: "Get GitHub auth token & setup octokit",
								task: async (ctx, task) => {
									const auth = await getGitHubAuthToken();
									if (!auth.succeeded) {
										throw new Error("❌ GitHub authentication failed.", {
											cause: auth.error,
										});
									}

									task.title = "GitHub auth token ✅";
									const MyOctokit = Octokit.plugin(retry);
									ctx.octokit = new MyOctokit({ auth: auth.token });
								},
							},
							{
								title: "Check prisma/release-ci.yml",
								task: async (ctx, task) => {
									const logPrefix = `prisma/release-ci.yml:`;
									const result =
										await ctx.octokit.rest.actions.listWorkflowRuns({
											owner,
											repo,
											branch: "main",
											workflow_id: "release-ci.yml",
											per_page: 50,
										});

									const inProgressRuns = result.data.workflow_runs.filter(
										(run) => run.status === "in_progress",
									);
									if (inProgressRuns.length !== 0) {
										task.title = `❌ ${logPrefix} a release is in progress (${inProgressRuns[0].display_title}) ${terminalLink("open on GitHub", inProgressRuns[0].html_url)}`;

										return;
									}
									const latestRun = result.data.workflow_runs[0];
									const resultLatestRunJobs =
										await ctx.octokit.rest.actions.listJobsForWorkflowRun({
											owner,
											repo,
											run_id: latestRun.id,
											per_page: 300,
										});

									if (latestRun.conclusion !== "success") {
										task.title = getMessageForWorkflowRun(
											logPrefix,
											getUnsuccessfulJobs(resultLatestRunJobs.data.jobs),
											latestRun,
										);

										return;
									}

									const resultLogs =
										await ctx.octokit.rest.actions.downloadWorkflowRunLogs({
											owner,
											repo,
											run_id: latestRun.id,
										});

									const outputLogAsText = await getOutputFile(
										resultLogs.data as ArrayBuffer,
									);

									let prismaVersion = "";
									for (const line of outputLogAsText.split("\n")) {
										if (line.includes("prismaVersion")) {
											prismaVersion = line.split('"prismaVersion":')[1].trim();
										}
									}

									let versionsFromString: RegExpMatchArray | null = null;
									try {
										versionsFromString = extractSemverFromString(prismaVersion);
									} catch (e) {
										throw new Error(
											`❌ ${logPrefix} extractSemverFromString("${latestRun.display_title}") failed with\n ${e}\n`,
										);
									}
									if (versionsFromString?.length !== 1) {
										throw new Error(
											`❌ ${logPrefix} Could not find a semver version in the run logs: ${latestRun.display_title}`,
										);
									}
									const versionFromGitHub = versionsFromString[0];

									task.title = `${logPrefix} last publish is ${versionFromGitHub} - ${terminalLink("latest run", latestRun.html_url)}`;
								},
							},
							{
								title: "Check prisma/release-latest.yml",
								task: async (ctx, task) => {
									const logPrefix = `prisma/release-latest.yml:`;
									const result =
										await ctx.octokit.rest.actions.listWorkflowRuns({
											owner,
											repo,
											branch: "main",
											workflow_id: "release-latest.yml",
											per_page: 50,
										});

									const inProgressRuns = result.data.workflow_runs.filter(
										(run) => run.status === "in_progress",
									);
									if (inProgressRuns.length !== 0) {
										task.title = `❌ ${logPrefix} a release is in progress (${inProgressRuns[0].display_title}) ${terminalLink("open on GitHub", inProgressRuns[0].html_url)}`;

										return;
									}
									const latestRun = result.data.workflow_runs[0];
									const resultLatestRunJobs =
										await ctx.octokit.rest.actions.listJobsForWorkflowRun({
											owner,
											repo,
											run_id: latestRun.id,
											per_page: 300,
										});

									if (latestRun.conclusion !== "success") {
										task.title = getMessageForWorkflowRun(
											logPrefix,
											getUnsuccessfulJobs(resultLatestRunJobs.data.jobs),
											latestRun,
										);

										return;
									}

									const resultLatestRun =
										await ctx.octokit.rest.actions.getWorkflowRun({
											owner,
											repo,
											run_id: latestRun.id,
										});

									let versionsFromString: RegExpMatchArray | null = null;
									try {
										versionsFromString = extractSemverFromString(
											resultLatestRun.data.display_title,
										);
									} catch (e) {
										throw new Error(
											`❌ ${logPrefix} extractSemverFromString("${latestRun.display_title}") failed with\n ${e}\n`,
										);
									}
									if (versionsFromString?.length !== 1) {
										throw new Error(
											`❌ ${logPrefix} Could not find a semver version in the name of the run: ${resultLatestRun.data.display_title}`,
										);
									}
									const versionFromGitHub = versionsFromString[0];

									if (!semver.eq(versionFromGitHub, ctx.versionLatest)) {
										throw new Error(
											`❌ ${logPrefix} The version from the last GitHub Actions run, "${versionFromGitHub}" is not the same as the latest version on npm: "${ctx.versionLatest}"`,
										);
									}

									task.title = `${logPrefix} last publish is ${versionFromGitHub} - ${terminalLink("latest run", latestRun.html_url)}`;
								},
							},
							{
								title: "Check language-tools/7_publish.yml",
								task: async (ctx, task) => {
									const repo = "language-tools";
									const logPrefix = `language-tools/7_publish.yml:`;
									const result =
										await ctx.octokit.rest.actions.listWorkflowRuns({
											owner,
											repo,
											branch: "main",
											workflow_id: "7_publish.yml",
											per_page: 50,
										});

									const inProgressRuns = result.data.workflow_runs.filter(
										(run) => run.status === "in_progress",
									);
									if (inProgressRuns.length !== 0) {
										task.title = `❌ ${logPrefix} a release is in progress (${inProgressRuns[0].display_title}) ${terminalLink("open on GitHub", inProgressRuns[0].html_url)}`;

										return;
									}
									const latestRun = result.data.workflow_runs[0];
									const resultLatestRunJobs =
										await ctx.octokit.rest.actions.listJobsForWorkflowRun({
											owner,
											repo,
											run_id: latestRun.id,
											per_page: 300,
										});

									if (latestRun.conclusion !== "success") {
										task.title = getMessageForWorkflowRun(
											logPrefix,
											getUnsuccessfulJobs(resultLatestRunJobs.data.jobs),
											latestRun,
										);

										return;
									}

									const resultLatestRun =
										await ctx.octokit.rest.actions.getWorkflowRun({
											owner,
											repo,
											run_id: latestRun.id,
										});

									let versionsFromString: RegExpMatchArray | null = null;
									try {
										versionsFromString = extractSemverFromString(
											latestRun.display_title,
										);
									} catch (e) {
										throw new Error(
											`❌ ${logPrefix} extractSemverFromString("${latestRun.display_title}") failed with\n ${e}\n`,
										);
									}
									if (versionsFromString?.length !== 1) {
										throw new Error(
											`❌ ${logPrefix} Could not find a semver version in the name of the run: ${latestRun.display_title}`,
										);
									}
									const lastVersionPublished = versionsFromString[0];

									if (!semver.eq(lastVersionPublished, ctx.versionDev)) {
										throw new Error(
											`❌ ${logPrefix} The last version published, "${lastVersionPublished}", is not the same as the "dev" version on npm: "${ctx.versionDev}"`,
										);
									}

									task.title = `${logPrefix} last publish is ${lastVersionPublished} - ${terminalLink("latest run", latestRun.html_url)}`;
								},
							},
							{
								title: "Check ecosystem-tests/test.yaml",
								task: async (ctx, task) => {
									const repo = "ecosystem-tests";
									const logPrefix = `${repo}/release-latest.yml:`;
									const result =
										await ctx.octokit.rest.actions.listWorkflowRuns({
											owner,
											repo,
											branch: "dev",
											workflow_id: "test.yaml",
											per_page: 50,
										});

									const inProgressRuns = result.data.workflow_runs.filter(
										(run) => run.status === "in_progress",
									);
									if (inProgressRuns.length !== 0) {
										task.title = `❌ ${logPrefix} a test run is in progress (${inProgressRuns[0].display_title}) ${terminalLink("open on GitHub", inProgressRuns[0].html_url)}`;

										return;
									}
									const latestRun = result.data.workflow_runs[0];
									const resultLatestRunJobs =
										await ctx.octokit.rest.actions.listJobsForWorkflowRun({
											owner,
											repo,
											run_id: latestRun.id,
											per_page: 300,
										});

									if (latestRun.conclusion !== "success") {
										task.title = getMessageForWorkflowRun(
											logPrefix,
											getUnsuccessfulJobs(resultLatestRunJobs.data.jobs),
											latestRun,
										);

										return;
									}

									let versionsFromString: RegExpMatchArray | null = null;
									try {
										versionsFromString = extractSemverFromString(
											latestRun.display_title,
										);
									} catch (e) {
										throw new Error(
											`❌ ${logPrefix} extractSemverFromString("${latestRun.display_title}") failed with\n ${e}\n`,
										);
									}
									if (versionsFromString?.length !== 1) {
										throw new Error(
											`❌ ${logPrefix} Could not find a semver version in the name of the run: ${latestRun.display_title}`,
										);
									}
									const lastVersionTested = versionsFromString[0];

									if (!semver.eq(lastVersionTested, ctx.versionDev)) {
										throw new Error(
											`❌ ${logPrefix} The last version tested, "${lastVersionTested}", is not the same as the "dev" version on npm: "${ctx.versionDev}"`,
										);
									}

									task.title = `${logPrefix} last publish is ${lastVersionTested} - ${terminalLink("latest run", latestRun.html_url)}`;
								},
							},
						],
						{ concurrent: false },
					),
			},
		],
		{
			concurrent: false,
			// renderer: "simple",
			// renderer: verbose && "verbose",
			rendererOptions: { collapseSubtasks: false },
		},
	);

	await tasks.run();
};
