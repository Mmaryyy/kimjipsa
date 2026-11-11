"""DEC-013: weekly local pg_dump; credentials stay in libpq service/pass files."""

import fcntl
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone


def backup(directory, retention_weeks, pg_bin):
    directory = Path(directory).expanduser().resolve()
    if any((parent / ".git").exists() for parent in (directory, *directory.parents)):
        raise ValueError("백업은 저장소 밖에 보관해 주세요.")
    if retention_weeks < 1:
        raise ValueError("백업 보관 주 수를 1 이상으로 정해 주세요.")
    for name in ("PGSERVICEFILE", "PGPASSFILE"):
        credential = Path(os.environ[name]).expanduser()
        if not credential.is_file() or credential.stat().st_mode & 0o077:
            raise ValueError("DB 인증 파일은 본인만 읽을 수 있어야 해요(600).")
    if not os.environ.get("PGSERVICE"):
        raise ValueError("PGSERVICE를 설정해 주세요.")
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    directory.chmod(0o700)
    with (directory / ".backup.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        now = datetime.now(timezone.utc)
        target = directory / f"kimjipsa-{now:%Y%m%dT%H%M%S%fZ}.dump"
        descriptor, temporary = tempfile.mkstemp(dir=directory, suffix=".partial")
        os.close(descriptor)
        try:
            command = [
                str(Path(pg_bin) / "pg_dump"), "--no-password",
                "--format=custom", "--no-owner", "--no-acl",
                "--schema=public", "--schema=auth", "--schema=private",
                f"--file={temporary}",
            ]
            # 대화·첨부·실행 원문을 백업으로 되살리지 않아요.
            for table in (
                "public.chat_messages", "public.chat_attachments",
                "public.agent_*", "public.receipt_imports",
                "private.agent_*", "private.chat_sessions",
                "private.cart_category_requests",
            ):
                command.append(f"--exclude-table-data={table}")
            environment = {
                **os.environ,
                "PGSSLMODE": "require",
                "PGCONNECT_TIMEOUT": "30",
            }
            subprocess.run(
                command, env=environment, check=True,
                capture_output=True, timeout=1800,
            )
            subprocess.run(
                [str(Path(pg_bin) / "pg_restore"), "--list", temporary],
                check=True, capture_output=True, timeout=60,
            )
            if Path(temporary).stat().st_size == 0:
                raise ValueError("빈 백업은 보관하지 않아요.")
            os.replace(temporary, target)
        finally:
            Path(temporary).unlink(missing_ok=True)
        cutoff = now - timedelta(weeks=retention_weeks)
        for archive in directory.glob("kimjipsa-*.dump"):
            try:
                created = datetime.strptime(
                    archive.name, "kimjipsa-%Y%m%dT%H%M%S%fZ.dump"
                ).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
            if archive != target and created < cutoff:
                archive.unlink()
        print(f"DB 백업 완료: {target.name}")


if __name__ == "__main__":
    os.umask(0o077)
    try:
        backup(
            os.environ["KIMJIPSA_BACKUP_DIR"],
            int(os.environ.get("KIMJIPSA_BACKUP_RETENTION_WEEKS", "4")),
            os.environ["KIMJIPSA_PG_BIN"],
        )
    except (OSError, ValueError, KeyError, subprocess.SubprocessError):
        # libpq 오류에는 접속 정보가 섞일 수 있어 원문을 로그에 남기지 않아요.
        print(
            "DB 백업 실패: 설정·인증 파일·디스크·DB 연결을 확인해 주세요.",
            file=sys.stderr,
        )
        sys.exit(1)
