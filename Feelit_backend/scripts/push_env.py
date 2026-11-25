"""Copy this folder's .env to FastAPI Cloud as the app's environment variables.

    python scripts/push_env.py https://your-app.vercel.app

Values go to the CLI on stdin, so no key ever appears in your shell history or on screen. Names that
look like credentials are stored as secrets. ENVIRONMENT becomes "production" and CORS_ORIGINS
becomes the frontend address you pass. Nothing is redeployed per variable; run `fastapi deploy` after.
Run it from the backend folder after `fastapi login` and a first `fastapi deploy` (which creates the app).
"""
import subprocess
import sys
from pathlib import Path

SECRET_WORDS = ("KEY", "SECRET", "URI", "PASSWORD", "TOKEN")


def read_env(path: Path) -> dict[str, str]:
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            name, value = line.split("=", 1)
            values[name.strip()] = value.strip().strip('"').strip("'")
    return values


def main() -> None:
    if len(sys.argv) != 2 or not sys.argv[1].startswith("https://"):
        sys.exit("Usage: python scripts/push_env.py https://<your-frontend-domain>")
    values = read_env(Path(__file__).resolve().parent.parent / ".env")
    values.update(ENVIRONMENT="production", CORS_ORIGINS=sys.argv[1].rstrip("/"))
    for name, value in values.items():
        if not value:
            print(f"skipped {name} (empty)")
            continue
        secret = any(word in name for word in SECRET_WORDS)
        command = ["fastapi", "cloud", "env", "set", name, "--value-stdin", "--no-redeploy", *(["--secret"] if secret else [])]
        result = subprocess.run(command, input=value, text=True, capture_output=True)
        print(f"{'set' if result.returncode == 0 else 'FAILED'} {name}{' (secret)' if secret else ''}")
        if result.returncode:
            sys.exit(result.stderr.strip() or result.stdout.strip())
    print("\nAll variables saved. Now run: fastapi deploy")


if __name__ == "__main__":
    main()
