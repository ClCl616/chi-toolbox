"""Independent local worker: reuses Notifier code, never its data or Discord dispatch."""
import argparse
from datetime import datetime, timezone
import importlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time

from projector import project, public_snapshot

def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=".toolbox-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)

def cycle(data, browser, offset):
    from dju_lms_notifier.storage.database import Database
    from dju_lms_notifier.lms.auth import AuthenticationError
    state_path = data / "worker-state.json"
    previous = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else None
    results, issues = [], []
    with Database(data / "notifier.sqlite3") as database:
        for category in ("notices", "materials", "assignments", "exams", "lessons"):
            try:
                module = importlib.import_module(f"dju_lms_notifier.lms.{category}")
                collected = getattr(module, f"collect_{category}")(data / "auth/storage_state.json", browser)
                database.process_results(collected)
                results.extend(collected)
                for result in collected:
                    if result.error:
                        issues.append(f"{category}:{result.course_id}:{result.error}")
                if any(result.error in ("auth_login_required", "auth_unknown") for result in collected):
                    break
            except AuthenticationError as error:
                issues.append("auth_" + error.status.value)
                break
            except FileNotFoundError:
                issues.append("auth_login_required")
                break
            except Exception:
                # Fixed category only: browser errors may expose cookies/URLs.
                issues.append(f"{category}:operation_failed")
            time.sleep(1)
        now = datetime.now(timezone.utc).isoformat()
        # This adapter deliberately targets the reviewed SQLite v5 schema.
        state = project(database._connection, previous, results, issues, now, offset)
        atomic_json(state_path, state)
        atomic_json(data / "snapshot.json", public_snapshot(state))
        print(f"LMS cycle: {state['status']}", flush=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--browser", default="msedge", choices=("msedge", "chromium", "chrome"))
    parser.add_argument("--login", action="store_true")
    parser.add_argument("--once", action="store_true")
    # User confirmed LMS wall-clock times are Korean Standard Time (2026-11-02).
    parser.add_argument("--utc-offset", default="+09:00", choices=("+09:00",), help="LMS time zone: confirmed Korean Standard Time")
    args = parser.parse_args()
    source, data = Path(args.source).resolve(), Path(args.data_dir).resolve()
    # Do not point a Toolbox worker at the existing Notifier's runtime data.
    if data == source or source in data.parents:
        raise SystemExit("Use a separate Toolbox data directory.")
    sys.path.insert(0, str(source / "src"))
    from dju_lms_notifier.runner import cycle_lock, AlreadyRunning
    from dju_lms_notifier.lms.auth import manual_login
    from dju_lms_notifier.storage.database import VERSION
    if VERSION != 5:
        raise SystemExit("Notifier schema changed; review the adapter first.")
    try:
        # Lifetime lock also protects login from a simultaneous background cycle.
        with cycle_lock(data):
            if args.login:
                status = manual_login(data / "auth/storage_state.json", args.browser, 600)
                print(f"LMS login: {status.value}")
                return 0 if status.value == "authenticated" else 2
            while True:
                started = time.monotonic()
                cycle(data, args.browser, 540 if args.utc_offset else None)
                if args.once:
                    break
                time.sleep(max(0, 1800 - (time.monotonic() - started)))
    except AlreadyRunning:
        print("LMS worker already running. Stop it before login or another worker.")
        return 1
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        pass
    except Exception:
        print("LMS worker stopped. Check local data permissions and the Notifier installation.", file=sys.stderr)
        raise SystemExit(1)
