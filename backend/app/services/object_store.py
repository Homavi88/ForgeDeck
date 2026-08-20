"""Local disk + optional S3. If bucket/credentials are missing, stay on disk."""

from __future__ import annotations

from pathlib import Path

from app.config import get_settings

settings = get_settings()


def _s3():
    if not settings.aws_s3_bucket:
        return None
    try:
        import boto3

        kwargs = {"region_name": settings.aws_s3_region}
        if settings.aws_access_key_id:
            kwargs["aws_access_key_id"] = settings.aws_access_key_id
            kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
        return boto3.client("s3", **kwargs)
    except Exception:
        return None


def upload_file(local: Path, key: str) -> str:
    client = _s3()
    if not client:
        return str(local)
    s3_key = f"{settings.s3_prefix}/{key}"
    client.upload_file(str(local), settings.aws_s3_bucket, s3_key)
    return f"s3://{settings.aws_s3_bucket}/{s3_key}"


def fetch_to_path(uri: str, dest: Path) -> Path:
    if not uri.startswith("s3://"):
        return Path(uri)
    client = _s3()
    if not client:
        raise FileNotFoundError(uri)
    _, _, rest = uri.partition("s3://")
    bucket, _, key = rest.partition("/")
    dest.parent.mkdir(parents=True, exist_ok=True)
    client.download_file(bucket, key, str(dest))
    return dest
