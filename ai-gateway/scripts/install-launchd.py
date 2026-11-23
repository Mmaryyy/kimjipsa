"""Install the existing local app and worker outside macOS-protected Desktop.

Copies only runtime inputs, keeps secrets local with restricted permissions,
and registers the same two user launchd jobs. No OS security settings change.
"""
import json
import os
import plistlib
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[2]
RUNTIME = Path.home() / 'Library/Application Support/kimjipsa'
LABELS = ['com.kimjipsa.local-app', 'com.kimjipsa.ai-gateway']
DOMAIN = f'gui/{os.getuid()}'
STOP_TIMEOUT_SECONDS = 30
DIRECTORIES = ['app', 'pages', 'src', 'public', 'mocks', 'node_modules', 'ai-gateway']
FILES = ['package.json', 'yarn.lock', 'tsconfig.json', 'next-env.d.ts',
         'next.config.ts', 'postcss.config.mjs', 'proxy.ts', '.env.local',
         'instrumentation.ts', 'instrumentation-client.ts']


def copy_directory(name):
    source, target = SOURCE / name, RUNTIME / name
    if not source.is_dir():
        raise RuntimeError(f'Missing runtime input: {name}')
    if not target.exists() and name != 'ai-gateway':
        cloned = subprocess.run(['/bin/cp', '-cR', str(source), str(target)],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if cloned.returncode == 0:
            return
    target.mkdir(exist_ok=True)
    # Dependency packages can require vendor files; only skip the old gateway bundle.
    excludes = ['--exclude=/vendor/'] if name == 'ai-gateway' else []
    subprocess.run(['/usr/bin/rsync', '-a', '--delete', '--exclude=.runtime/',
                    '--exclude=.git/', *excludes,
                    f'{source}/', f'{target}/'], check=True)


def replace_paths(value, template_root):
    if isinstance(value, str):
        return value.replace(template_root, str(RUNTIME))
    if isinstance(value, list):
        return [replace_paths(item, template_root) for item in value]
    if isinstance(value, dict):
        return {key: replace_paths(item, template_root) for key, item in value.items()}
    return value


def stop_service(label):
    service = f'{DOMAIN}/{label}'
    print(f'Stopping {label}...', flush=True)
    stopped = subprocess.run(['launchctl', 'bootout', service],
                             capture_output=True, text=True, timeout=10)
    deadline = time.monotonic() + STOP_TIMEOUT_SECONDS
    # bootout can return before launchd finishes removing the service.
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise RuntimeError(
                f'Timed out waiting for {label} to be removed; '
                'services were not re-registered')
        status = subprocess.run(['launchctl', 'print', service],
                                capture_output=True, text=True,
                                timeout=min(5, remaining))
        if status.returncode == 113 and (
            f'Could not find service "{label}"' in status.stderr
        ):
            print(f'Stopped {label}', flush=True)
            return
        if stopped.returncode != 0 or status.returncode != 0:
            detail = (stopped.stderr + status.stderr).strip()
            raise RuntimeError(f'Could not stop or inspect {label}: {detail}')
        time.sleep(min(0.2, max(0, deadline - time.monotonic())))


def main():
    if SOURCE == RUNTIME.resolve():
        raise RuntimeError('Run this installer from the source repository')
    # Check required inputs before stopping the currently installed services.
    for name in DIRECTORIES + [name for name in FILES if name != 'next-env.d.ts'] + [
        'ai-gateway/config.local.json',
        *[f'ai-gateway/launchd/{label}.plist' for label in LABELS],
    ]:
        if not (SOURCE / name).exists():
            raise RuntimeError(f'Missing runtime input: {name}')
    marker = RUNTIME / '.kimjipsa-managed-runtime'
    if RUNTIME.exists() and not marker.exists():
        raise RuntimeError('Runtime folder exists without a managed marker; nothing overwritten')
    RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
    RUNTIME.chmod(0o700)
    marker.write_text(str(SOURCE) + '\n')
    for label in reversed(LABELS):
        stop_service(label)
    for name in DIRECTORIES:
        print(f'Preparing {name}...', flush=True)
        copy_directory(name)
    for name in FILES:
        source = SOURCE / name
        if source.is_file():
            shutil.copy2(source, RUNTIME / name)
    for name in ['.env.local', 'ai-gateway/config.local.json']:
        path = RUNTIME / name
        if path.exists():
            path.chmod(0o600)
    (RUNTIME / 'ai-gateway/.runtime').mkdir(exist_ok=True, mode=0o700)
    launch_agents = Path.home() / 'Library/LaunchAgents'
    launch_agents.mkdir(exist_ok=True)
    for label in LABELS:
        source = SOURCE / 'ai-gateway/launchd' / f'{label}.plist'
        template = plistlib.loads(source.read_bytes())
        config = replace_paths(template, template['WorkingDirectory'])
        target = launch_agents / source.name
        target.write_bytes(plistlib.dumps(config))
        target.chmod(0o644)
        subprocess.run(['launchctl', 'bootstrap', DOMAIN, str(target)], check=True)
        print(f'Started {label}', flush=True)
    for attempt in range(30):
        try:
            with urllib.request.urlopen('http://127.0.0.1:8644/health', timeout=2) as response:
                health = json.load(response)
            if health.get('state') in ['ready', 'running']:
                print('Kimjipsa connected:', health['state'], flush=True)
                return
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(2)
    print('Services installed; startup is still pending. Tell Codex to check the runtime logs.', flush=True)


if __name__ == '__main__':
    main()
