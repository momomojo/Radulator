#!/usr/bin/env python3
"""Read-only macOS TCP pressure preflight for local Playwright/Vite runs.

This tool never changes sysctls, sockets, processes, firewall rules, or routes.
It only reads ``netstat``/``sysctl`` (or deterministic fixture files) and exits
non-zero before an IPv4 local test invocation can worsen port pressure.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import time
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

WARN_RATIO = 0.60
CRITICAL_RATIO = 0.75


@dataclass(frozen=True)
class Snapshot:
    ephemeral_first: int
    ephemeral_last: int
    ephemeral_capacity: int
    ipv4_time_wait: int
    ipv6_time_wait: int
    top_ipv4_time_wait_peer: str | None
    top_ipv4_time_wait_peer_count: int


def _run(*command: str) -> str:
    return subprocess.check_output(command, text=True, stderr=subprocess.STDOUT)


def _read_live_netstat() -> str:
    return _run("netstat", "-an", "-p", "tcp")


def _read_live_sysctl() -> str:
    return _run("sysctl", "net.inet.ip.portrange.first", "net.inet.ip.portrange.last")


def parse_portrange(sysctl_text: str) -> tuple[int, int]:
    values: dict[str, int] = {}
    for line in sysctl_text.splitlines():
        key, separator, value = line.partition(":")
        if not separator:
            continue
        key = key.strip()
        if key in {"net.inet.ip.portrange.first", "net.inet.ip.portrange.last"}:
            values[key] = int(value.strip())
    first = values["net.inet.ip.portrange.first"]
    last = values["net.inet.ip.portrange.last"]
    if first > last:
        raise ValueError(f"invalid ephemeral range: {first}>{last}")
    return first, last


def iter_tcp_rows(netstat_text: str) -> Iterable[tuple[str, str, str, str]]:
    """Yield (family, local, peer, state) from macOS ``netstat -an -p tcp``."""
    for line in netstat_text.splitlines():
        fields = line.split()
        # macOS output begins: proto recv-q send-q local foreign state.
        if len(fields) < 6 or fields[0] not in {"tcp4", "tcp6"}:
            continue
        yield fields[0], fields[3], fields[4], fields[5]


def make_snapshot(netstat_text: str, sysctl_text: str) -> Snapshot:
    first, last = parse_portrange(sysctl_text)
    ipv4_peers: Counter[str] = Counter()
    ipv6_time_wait = 0
    for family, _local, peer, state in iter_tcp_rows(netstat_text):
        if state != "TIME_WAIT":
            continue
        if family == "tcp4":
            ipv4_peers[peer] += 1
        else:
            ipv6_time_wait += 1
    peer, peer_count = (None, 0)
    if ipv4_peers:
        peer, peer_count = sorted(ipv4_peers.items(), key=lambda item: (-item[1], item[0]))[0]
    return Snapshot(
        ephemeral_first=first,
        ephemeral_last=last,
        ephemeral_capacity=last - first + 1,
        ipv4_time_wait=sum(ipv4_peers.values()),
        ipv6_time_wait=ipv6_time_wait,
        top_ipv4_time_wait_peer=peer,
        top_ipv4_time_wait_peer_count=peer_count,
    )


def assess(snapshot: Snapshot, warn_ratio: float, critical_ratio: float) -> tuple[str, list[str]]:
    if not 0 < warn_ratio < critical_ratio <= 1:
        raise ValueError("require 0 < warn_ratio < critical_ratio <= 1")
    capacity = snapshot.ephemeral_capacity
    total_ratio = snapshot.ipv4_time_wait / capacity
    peer_ratio = snapshot.top_ipv4_time_wait_peer_count / capacity
    reasons: list[str] = []
    if total_ratio >= critical_ratio:
        reasons.append(f"IPv4 TIME_WAIT is {total_ratio:.1%} of the ephemeral range")
    if peer_ratio >= critical_ratio:
        reasons.append(
            f"top peer {snapshot.top_ipv4_time_wait_peer} is {peer_ratio:.1%} of the ephemeral range"
        )
    if reasons:
        return "critical", reasons
    if total_ratio >= warn_ratio or peer_ratio >= warn_ratio:
        return "warning", [
            f"IPv4 TIME_WAIT is {total_ratio:.1%}; defer high-concurrency IPv4 local tests"
        ]
    return "ok", ["IPv4 TIME_WAIT pressure is below configured thresholds"]


def read_input(path: str | None, live_reader) -> str:
    return Path(path).read_text() if path else live_reader()


def collect(args: argparse.Namespace) -> tuple[Snapshot, str, list[str]]:
    netstat_text = read_input(args.netstat_file, _read_live_netstat)
    sysctl_text = read_input(args.sysctl_file, _read_live_sysctl)
    snapshot = make_snapshot(netstat_text, sysctl_text)
    status, reasons = assess(snapshot, args.warn_ratio, args.critical_ratio)
    return snapshot, status, reasons


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--netstat-file", help="fixture capture instead of invoking netstat")
    parser.add_argument("--sysctl-file", help="fixture capture instead of invoking sysctl")
    parser.add_argument("--warn-ratio", type=float, default=WARN_RATIO)
    parser.add_argument("--critical-ratio", type=float, default=CRITICAL_RATIO)
    parser.add_argument("--samples", type=int, default=1, help="read-only samples to collect")
    parser.add_argument("--interval", type=float, default=0, help="seconds between samples")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--assert-safe", action="store_true", help="exit 75 unless status is ok")
    args = parser.parse_args(argv)
    if args.samples < 1 or args.interval < 0:
        parser.error("--samples must be >= 1 and --interval must be >= 0")
    if args.samples > 1 and (args.netstat_file or args.sysctl_file):
        parser.error("fixture inputs support exactly one sample")

    snapshots: list[dict[str, object]] = []
    statuses: list[str] = []
    reasons: list[str] = []
    for index in range(args.samples):
        snapshot, status, sample_reasons = collect(args)
        snapshots.append(asdict(snapshot))
        statuses.append(status)
        reasons.extend(sample_reasons)
        if index + 1 < args.samples and args.interval:
            time.sleep(args.interval)
    status = "critical" if "critical" in statuses else "warning" if "warning" in statuses else "ok"
    payload = {"status": status, "samples": snapshots, "reasons": reasons}
    if args.json:
        print(json.dumps(payload, sort_keys=True))
    else:
        latest = snapshots[-1]
        print(
            f"{status.upper()}: ipv4_time_wait={latest['ipv4_time_wait']} "
            f"range={latest['ephemeral_capacity']} top_peer={latest['top_ipv4_time_wait_peer']} "
            f"top_peer_count={latest['top_ipv4_time_wait_peer_count']}"
        )
        for reason in reasons:
            print(f"- {reason}")
        if status != "ok":
            print("- Do not start an IPv4 Playwright/Vite run. Wait for pressure to decay or use an explicitly approved bounded IPv6 test path.")
    return 75 if args.assert_safe and status != "ok" else 0


if __name__ == "__main__":
    raise SystemExit(main())
