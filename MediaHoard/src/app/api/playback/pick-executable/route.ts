import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

type PickResult = {
    path: string;
    name: string;
} | null;

const fileNameFromPath = (selectedPath: string) =>
    selectedPath.split(/[\\/]/).filter(Boolean).at(-1) || selectedPath;

const pickWithWindowsDialog = async (title: string): Promise<PickResult> => {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = '${title.replace(/'/g, "''")}'
$dialog.Filter = 'Executables|*.exe;*.bat;*.cmd;*.com|All files|*.*'
$dialog.Multiselect = $false
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Write($dialog.FileName)
}
`;

    const { stdout } = await execFileAsync("powershell", [
        "-NoProfile",
        "-STA",
        "-Command",
        script,
    ]);

    const selectedPath = stdout.trim();
    if (!selectedPath) {
        return null;
    }

    return {
        path: selectedPath,
        name: fileNameFromPath(selectedPath),
    };
};

const pickWithMacDialog = async (title: string): Promise<PickResult> => {
    const script = `POSIX path of (choose file with prompt "${title.replace(/"/g, '\\"')}")`;
    const { stdout } = await execFileAsync("osascript", ["-e", script]);
    const selectedPath = stdout.trim();

    if (!selectedPath) {
        return null;
    }

    return {
        path: selectedPath,
        name: fileNameFromPath(selectedPath),
    };
};

const pickWithZenityDialog = async (title: string): Promise<PickResult> => {
    const { stdout } = await execFileAsync("zenity", [
        "--file-selection",
        "--title",
        title,
    ]);
    const selectedPath = stdout.trim();

    if (!selectedPath) {
        return null;
    }

    return {
        path: selectedPath,
        name: fileNameFromPath(selectedPath),
    };
};

export async function POST(request: Request) {
    const body = await request.json().catch(() => null) as { title?: string } | null;
    const title = body?.title?.trim() || "Select player executable";

    try {
        if (!["win32", "darwin", "linux"].includes(process.platform)) {
            return Response.json({ error: "Executable picking is not supported on this host platform." }, { status: 400 });
        }

        const result = process.platform === "win32"
            ? await pickWithWindowsDialog(title)
            : process.platform === "darwin"
                ? await pickWithMacDialog(title)
                : await pickWithZenityDialog(title);

        return Response.json({ result });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to open executable picker.";
        return Response.json({ error: message }, { status: 500 });
    }
}
