#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
import shlex
import subprocess
import time
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
VIDEO_DIR = ROOT / "public" / "browser-skill-distillation" / "cases" / "videos"
OUT_DIR = ROOT / "tmp_osworld_rerecord_clean"

VMRUN = os.environ.get("VMRUN", "/Applications/VMware Fusion.app/Contents/Library/vmrun")
VMX = os.environ.get("OSWORLD_VMX", "")
USER = os.environ.get("OSWORLD_GUEST_USER", "user")
PASSWORD = os.environ.get("OSWORLD_GUEST_PASSWORD", "password")
FFMPEG = Path(os.environ.get("IMAGEIO_FFMPEG", shutil.which("ffmpeg") or "ffmpeg"))

ENV = """\
export HOME=/home/user
export DISPLAY=:0
export XAUTHORITY=/home/user/.Xauthority
export XDG_RUNTIME_DIR=/run/user/1000
export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
export PULSE_SERVER=unix:/run/user/1000/pulse/native
"""


def run(cmd: list[str], timeout: int = 120, check: bool = True) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if check and proc.returncode != 0:
        raise RuntimeError(
            f"Command failed ({proc.returncode}): {' '.join(shlex.quote(c) for c in cmd)}\n"
            f"STDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
        )
    return proc


def vmrun(args: list[str], timeout: int = 120, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run([VMRUN, "-T", "fusion", *args], timeout=timeout, check=check)


def guest(args: list[str], timeout: int = 120, check: bool = True) -> subprocess.CompletedProcess[str]:
    return vmrun(["-gu", USER, "-gp", PASSWORD, *args], timeout=timeout, check=check)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def copy_to_guest(local: Path, remote: str) -> None:
    guest(["copyFileFromHostToGuest", VMX, str(local), remote], timeout=60)


def copy_from_guest(remote: str, local: Path, check: bool = True) -> bool:
    local.parent.mkdir(parents=True, exist_ok=True)
    proc = guest(["copyFileFromGuestToHost", VMX, remote, str(local)], timeout=120, check=False)
    if proc.returncode != 0:
        if check:
            raise RuntimeError(proc.stderr or proc.stdout)
        return False
    return True


def ensure_vm() -> None:
    if not VMX:
        raise RuntimeError("Set OSWORLD_VMX to the VMware .vmx path before running this script.")
    listed = vmrun(["list"], timeout=20, check=False)
    if VMX not in listed.stdout:
        vmrun(["start", VMX, "gui"], timeout=90)
    deadline = time.time() + 90
    while time.time() < deadline:
        tools = vmrun(["checkToolsState", VMX], timeout=15, check=False)
        if "running" in (tools.stdout + tools.stderr).lower():
            probe = guest(["listProcessesInGuest", VMX], timeout=20, check=False)
            if probe.returncode == 0:
                return
        time.sleep(2)
    raise TimeoutError("VMware Tools did not become ready")


COMMON_PREPARE = f"""#!/usr/bin/env bash
set -euo pipefail
{ENV}
xrandr --output Virtual-1 --mode 1920x1080 >/dev/null 2>&1 || true
gsettings set org.gnome.desktop.interface text-scaling-factor 1.0 >/dev/null 2>&1 || true
gsettings set org.gnome.desktop.notifications show-banners true >/dev/null 2>&1 || true
if command -v wmctrl >/dev/null 2>&1; then
  wmctrl -l | awk '{{print $1}}' | while read -r win; do
    [ -n "$win" ] && wmctrl -i -c "$win" >/dev/null 2>&1 || true
  done
  sleep 0.7
fi
pkill -f gnome-control-center >/dev/null 2>&1 || true
nautilus -q >/dev/null 2>&1 || true
pkill -9 -f nautilus >/dev/null 2>&1 || true
pkill -f 'vlc' >/dev/null 2>&1 || true
pkill -9 -x code >/dev/null 2>&1 || true
pkill -9 -f '/usr/share/code|/snap/code|Code Helper|--user-data-dir /tmp/case-study-code-profile' >/dev/null 2>&1 || true
pkill -9 -f 'gedit|gnome-text-editor|texteditor|org.gnome.TextEditor' >/dev/null 2>&1 || true
pkill -9 -f 'zenity' >/dev/null 2>&1 || true
mkdir -p "$HOME/Desktop" "$HOME/.config/vlc" "$HOME/.config/Code/User"
rm -rf /tmp/case-study-code-profile /tmp/codex-gui-code-profile

STASH=/tmp/codex_clean_demo_desktop_stash
mkdir -p "$STASH"
if [ ! -f "$STASH/.active" ]; then
  find "$HOME/Desktop" -mindepth 1 -maxdepth 1 -exec mv -t "$STASH" {{}} + 2>/dev/null || true
  touch "$STASH/.active"
else
  find "$HOME/Desktop" -mindepth 1 -maxdepth 1 -exec rm -rf {{}} + 2>/dev/null || true
fi
sleep 1
"""


SOLVE_PREAMBLE = """#!/usr/bin/env python3
import os
import subprocess
import time

os.environ.update({
    "DISPLAY": ":0",
    "XAUTHORITY": "/home/user/.Xauthority",
    "XDG_RUNTIME_DIR": "/run/user/1000",
    "DBUS_SESSION_BUS_ADDRESS": "unix:path=/run/user/1000/bus",
    "PULSE_SERVER": "unix:/run/user/1000/pulse/native",
})

import pyautogui

pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.08
pyautogui.press("esc", presses=4, interval=0.15)
time.sleep(0.4)


def move(x, y, duration=0.45):
    pyautogui.moveTo(x, y, duration=duration, tween=pyautogui.easeInOutQuad)


def click(x, y, duration=0.35):
    move(x, y, duration)
    pyautogui.click()
    time.sleep(0.35)


def drag(start_x, start_y, end_x, end_y, duration=1.1):
    move(start_x, start_y, 0.5)
    pyautogui.dragTo(end_x, end_y, duration=duration, button="left")
    time.sleep(0.4)


def launcher(command, wait=1.5):
    pyautogui.hotkey("alt", "f2")
    time.sleep(0.35)
    pyautogui.write(command, interval=0.01)
    pyautogui.press("enter")
    time.sleep(wait)


def wait_window(fragment, timeout=15):
    deadline = time.time() + timeout
    while time.time() < deadline:
        proc = subprocess.run(["wmctrl", "-l"], text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        if fragment.lower() in proc.stdout.lower():
            return True
        time.sleep(0.25)
    return False


def type_text(text, interval=0.002):
    for ch in text:
        if ch == "\\n":
            pyautogui.press("enter")
        elif ch == "\\t":
            pyautogui.press("tab")
        else:
            pyautogui.write(ch, interval=interval)


def edit_file_visibly(path, content, wait=2.0):
    launcher("gedit " + path, wait=wait)
    wait_window("gedit", 8)
    time.sleep(1.0)
    click(950, 300, 0.2)
    pyautogui.hotkey("ctrl", "a")
    time.sleep(0.2)
    pyautogui.press("backspace")
    time.sleep(0.2)
    type_text(content, interval=0.002)
    time.sleep(0.4)
    pyautogui.hotkey("ctrl", "s")
    time.sleep(1.0)
"""


def prepare(extra: str = "") -> str:
    return COMMON_PREPARE + "\n" + extra.strip() + "\n"


def solve(body: str) -> str:
    return SOLVE_PREAMBLE + "\n" + body.strip() + "\n"


def verify(body: str) -> str:
    return f"""#!/usr/bin/env bash
set -euo pipefail
{ENV}
{body.strip()}
"""


def record_script(duration: int, fps: int = 15) -> str:
    return f"""#!/usr/bin/env bash
set -euo pipefail
{ENV}
rm -f /tmp/codex_gui_recording.mp4 /tmp/codex_gui_ffmpeg.log /tmp/codex_gui_solve.out /tmp/codex_gui_verify.out
ffmpeg -y -nostdin -f x11grab -draw_mouse 1 -framerate {fps} -video_size 1920x1080 \\
  -i :0.0 -t {duration} -c:v libx264 -preset ultrafast -pix_fmt yuv420p \\
  -movflags +faststart /tmp/codex_gui_recording.mp4 >/tmp/codex_gui_ffmpeg.log 2>&1 &
ffmpeg_pid=$!
sleep 1
python3 /tmp/codex_gui_solve.py >/tmp/codex_gui_solve.out 2>&1 || true
sleep 1
bash /tmp/codex_gui_verify.sh >/tmp/codex_gui_verify.out 2>&1 || true
wait "$ffmpeg_pid"
"""


def restore_desktop() -> None:
    script = f"""#!/usr/bin/env bash
set -euo pipefail
{ENV}
STASH=/tmp/codex_clean_demo_desktop_stash
mkdir -p "$HOME/Desktop"
if [ -f "$STASH/.active" ]; then
  find "$HOME/Desktop" -mindepth 1 -maxdepth 1 -exec rm -rf {{}} + 2>/dev/null || true
  find "$STASH" -mindepth 1 -maxdepth 1 ! -name .active -exec mv -t "$HOME/Desktop" {{}} + 2>/dev/null || true
  rm -rf "$STASH"
fi
"""
    tmp = OUT_DIR / "restore_desktop.sh"
    write(tmp, script)
    copy_to_guest(tmp, "/tmp/codex_gui_restore_desktop.sh")
    guest(["runScriptInGuest", VMX, "/bin/bash", "bash /tmp/codex_gui_restore_desktop.sh"], timeout=120, check=False)


def cases() -> list[dict[str, Any]]:
    clean_vscode_settings = (
        "rm -rf \"$HOME/.config/Code\"\n"
        "mkdir -p \"$HOME/.config/Code/User\"\n"
        "printf '{\\n  \"workbench.startupEditor\": \"none\"\\n}\\n' > \"$HOME/.config/Code/User/settings.json\""
    )
    minimap_verify = verify(
        "python3 - <<'PY'\n"
        "import json, pathlib, sys\n"
        "data=json.loads(pathlib.Path.home().joinpath('.config/Code/User/settings.json').read_text())\n"
        "print(data)\n"
        "sys.exit(0 if data.get('editor.minimap.enabled') is False else 1)\n"
        "PY"
    )
    return [
        {
            "id": "vscode_minimap_base",
            "target": "osworld_vscode_minimap_base.mp4",
            "duration": 42,
            "expect_rc": 1,
            "prepare": prepare(
                clean_vscode_settings
            ),
            "solve": solve(
                """
launcher("code --no-sandbox", wait=8.0)
time.sleep(2.0)
pyautogui.hotkey("ctrl", ",")
time.sleep(1.0)
pyautogui.write("minimap enabled", interval=0.03)
time.sleep(2.0)
"""
            ),
            "verify": minimap_verify,
        },
        {
            "id": "vscode_minimap_skill",
            "target": "osworld_vscode_minimap_skill.mp4",
            "duration": 30,
            "expect_rc": 0,
            "prepare": prepare(
                clean_vscode_settings
            ),
            "solve": solve("edit_file_visibly('/home/user/.config/Code/User/settings.json', '{\\n  \"editor.minimap.enabled\": false\\n}\\n')"),
            "verify": minimap_verify,
        },
        {
            "id": "vscode_minimap_irrelevant",
            "target": "osworld_vscode_minimap_irrelevant.mp4",
            "duration": 26,
            "expect_rc": 1,
            "prepare": prepare(
                clean_vscode_settings + "\n"
                "pulseaudio --start >/dev/null 2>&1 || true\n"
                "pactl set-sink-volume @DEFAULT_SINK@ 25% || true"
            ),
            "solve": solve(
                """
launcher("gnome-control-center sound", wait=1.8)
wait_window("Settings", 10)
drag(966, 282, 1335, 282, 1.1)
click(1335, 282, 0.25)
"""
            ),
            "verify": minimap_verify,
        },
        {
            "id": "file_manager_base",
            "target": "osworld_file_manager_base.mp4",
            "duration": 24,
            "expect_rc": 1,
            "prepare": prepare("rm -rf \"$HOME/Desktop/gui_folder_4821\""),
            "solve": solve(
                """
launcher("nautilus /home/user/Desktop", wait=2.0)
wait_window("Desktop", 8)
time.sleep(1.0)
"""
            ),
            "verify": verify("test -d \"$HOME/Desktop/gui_folder_4821\""),
        },
        {
            "id": "file_manager_skill",
            "target": "osworld_file_manager_skill.mp4",
            "duration": 26,
            "expect_rc": 0,
            "prepare": prepare("rm -rf \"$HOME/Desktop/gui_folder_4821\""),
            "solve": solve(
                """
launcher("nautilus /home/user/Desktop", wait=2.0)
wait_window("Desktop", 8)
pyautogui.hotkey("ctrl", "shift", "n")
time.sleep(0.8)
pyautogui.write("gui_folder_4821", interval=0.02)
pyautogui.press("enter")
time.sleep(1.0)
"""
            ),
            "verify": verify("test -d \"$HOME/Desktop/gui_folder_4821\""),
        },
    ]


def crop_for_page(src: Path, dst: Path) -> None:
    if not FFMPEG.exists():
        raise FileNotFoundError(f"ffmpeg not found: {FFMPEG}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            str(FFMPEG),
            "-y",
            "-i",
            str(src),
            "-vf",
            "crop=1728:1080:96:0,scale=960:600",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "30",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(dst),
        ],
        timeout=120,
    )


def run_case(case: dict[str, Any]) -> dict[str, Any]:
    case_dir = OUT_DIR / case["id"]
    case_dir.mkdir(parents=True, exist_ok=True)
    write(case_dir / "prepare.sh", case["prepare"])
    write(case_dir / "solve.py", case["solve"])
    write(case_dir / "verify.sh", case["verify"])
    write(case_dir / "record.sh", record_script(case["duration"]))

    copy_to_guest(case_dir / "prepare.sh", "/tmp/codex_gui_prepare.sh")
    copy_to_guest(case_dir / "solve.py", "/tmp/codex_gui_solve.py")
    copy_to_guest(case_dir / "verify.sh", "/tmp/codex_gui_verify.sh")
    copy_to_guest(case_dir / "record.sh", "/tmp/codex_gui_record.sh")

    prep = guest(["runScriptInGuest", VMX, "/bin/bash", "bash /tmp/codex_gui_prepare.sh >/tmp/codex_gui_prepare.out 2>&1"], timeout=120, check=False)
    write(case_dir / "prepare.vmrun.stdout.txt", prep.stdout)
    write(case_dir / "prepare.vmrun.stderr.txt", prep.stderr)

    rec = guest(
        ["runScriptInGuest", VMX, "/bin/bash", "bash /tmp/codex_gui_record.sh >/tmp/codex_gui_record.out 2>&1"],
        timeout=case["duration"] + 180,
        check=False,
    )
    write(case_dir / "record.vmrun.stdout.txt", rec.stdout)
    write(case_dir / "record.vmrun.stderr.txt", rec.stderr)
    copy_from_guest("/tmp/codex_gui_recording.mp4", case_dir / "recording_raw.mp4")
    copy_from_guest("/tmp/codex_gui_prepare.out", case_dir / "prepare.out.txt", check=False)
    copy_from_guest("/tmp/codex_gui_record.out", case_dir / "record.out.txt", check=False)
    copy_from_guest("/tmp/codex_gui_ffmpeg.log", case_dir / "ffmpeg.log", check=False)
    copy_from_guest("/tmp/codex_gui_solve.out", case_dir / "solve.out.txt", check=False)
    copy_from_guest("/tmp/codex_gui_verify.out", case_dir / "verify.out.txt", check=False)

    verify_proc = guest(
        ["runScriptInGuest", VMX, "/bin/bash", "bash /tmp/codex_gui_verify.sh >/tmp/codex_gui_verify_second.out 2>&1"],
        timeout=60,
        check=False,
    )
    copy_from_guest("/tmp/codex_gui_verify_second.out", case_dir / "verify.second.out.txt", check=False)

    page_video = VIDEO_DIR / case["target"]
    crop_for_page(case_dir / "recording_raw.mp4", page_video)

    result = {
        "id": case["id"],
        "target": str(page_video),
        "record_returncode": rec.returncode,
        "returncode": verify_proc.returncode,
        "expected_returncode": case["expect_rc"],
        "expected_observed": verify_proc.returncode == case["expect_rc"],
    }
    write(case_dir / "result.json", json.dumps(result, indent=2) + "\n")
    return result


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ensure_vm()
    results: list[dict[str, Any]] = []
    try:
        for case in cases():
            print(f"[record] {case['id']} -> {case['target']}", flush=True)
            results.append(run_case(case))
            write(OUT_DIR / "results.json", json.dumps(results, indent=2) + "\n")
    finally:
        restore_desktop()
    failures = [r for r in results if not r["expected_observed"]]
    print(json.dumps(results, indent=2), flush=True)
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
