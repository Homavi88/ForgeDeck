import secrets
from pathlib import Path


def ensure_secret_key(env_path: Path) -> str:
    """Replace the placeholder SECRET_KEY in .env with a random value."""
    text = env_path.read_text(encoding="utf-8") if env_path.exists() else ""
    if "SECRET_KEY=change-me-to-a-long-random-string" not in text and "SECRET_KEY=" in text:
        for line in text.splitlines():
            if line.startswith("SECRET_KEY=") and "change-me" not in line and line.strip() != "SECRET_KEY=":
                return line.split("=", 1)[1].strip()
    key = secrets.token_urlsafe(48)
    if "SECRET_KEY=" in text:
        lines = []
        for line in text.splitlines():
            if line.startswith("SECRET_KEY="):
                lines.append(f"SECRET_KEY={key}")
            else:
                lines.append(line)
        env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    else:
        env_path.write_text(text + f"\nSECRET_KEY={key}\n", encoding="utf-8")
    return key


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    path = root / ".env"
    if not path.exists() and (root / ".env.example").exists():
        path.write_text((root / ".env.example").read_text(encoding="utf-8"), encoding="utf-8")
    print(ensure_secret_key(path))
