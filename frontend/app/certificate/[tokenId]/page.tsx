"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getSettlementCertificate,
  type SettlementCertificateRecord,
} from "@/lib/deal-room/settlementV2";
import { NETWORK } from "@/lib/starknet/constants";

function short(value: string): string {
  return value.length > 22
    ? `${value.slice(0, 11)}…${value.slice(-9)}`
    : value;
}

function formatTime(value: number): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value * 1000));
}

export default function CertificatePage() {
  const params = useParams<{ tokenId: string }>();
  const tokenId = useMemo(
    () => params.tokenId ?? "",
    [params.tokenId],
  );
  const [record, setRecord] =
    useState<SettlementCertificateRecord | null>(null);
  const [status, setStatus] =
    useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    try {
      void getSettlementCertificate(BigInt(tokenId)).then((next) => {
        if (cancelled) return;
        setRecord(next);
        setStatus(next ? "ready" : "missing");
      });
    } catch {
      setStatus("missing");
    }

    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  return (
    <main className="min-h-screen bg-ink text-paper">
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="flex items-center justify-between border-b border-wire/70 pb-4">
          <Link
            className="font-display text-[9px] uppercase tracking-[0.18em] text-paper/45 hover:text-signal"
            href="/"
          >
            ← VINSS
          </Link>
          <span className="font-display text-[8px] uppercase tracking-[0.16em] text-signal">
            Public evidence · {NETWORK}
          </span>
        </header>

        <section className="grid gap-8 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center">
          <img
            alt={`VINSS Settlement Certificate #${tokenId}`}
            className="w-full border border-wire/80 bg-vault"
            src={`/api/certificates/${tokenId}/image`}
          />

          <div>
            <p className="font-display text-[9px] uppercase tracking-[0.24em] text-signal">
              NFT Settlement Certificate
            </p>
            <h1 className="mt-4 break-words text-3xl font-medium tracking-tight sm:text-4xl">
              Rekber settlement evidence
            </h1>
            <p className="mt-4 text-sm leading-6 text-paper/45">
              This certificate is optional public evidence of a successful
              Rekber release, self-claimed by the displayed wallet. It is that
              party&apos;s acknowledgement of the settlement record; it is not
              proof of hidden-note ownership by itself. It does not contain
              private messages, Offer terms, deal notes, secrets, asset, or
              amount.
            </p>

            {status === "loading" && (
              <p className="mt-7 text-xs text-paper/35">Reading Starknet…</p>
            )}

            {status === "missing" && (
              <div className="mt-7 border border-amber/25 bg-amber/[0.04] p-4">
                <p className="text-xs text-amber">
                  Certificate not found on the configured {NETWORK} contract.
                </p>
              </div>
            )}

            {record && status === "ready" && (
              <dl className="mt-7 divide-y divide-wire/55 border-y border-wire/70 text-xs">
                {[
                  ["Issued to", short(record.recipient)],
                  ["Role", record.role],
                  ["Settled", formatTime(record.settledAt)],
                  ["Issued", formatTime(record.issuedAt)],
                  ["Token ID", short(record.tokenId.toString())],
                  [
                    "Custody proof",
                    short(`0x${record.custodyCommitment.toString(16)}`),
                  ],
                ].map(([label, value]) => (
                  <div
                    className="grid grid-cols-[7rem_1fr] gap-4 py-3"
                    key={label}
                  >
                    <dt className="font-display text-[8px] uppercase tracking-[0.14em] text-paper/28">
                      {label}
                    </dt>
                    <dd className="break-all text-paper/62">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>

        <footer className="border-t border-wire/60 pt-5 text-[10px] leading-5 text-paper/25">
          Privacy boundary: certificate ownership, issued recipient, role, and
          settlement reference are public and can be correlated with the public
          Rekber token, amount, and timing. The private coordination layer
          remains outside NFT metadata.
        </footer>
      </div>
    </main>
  );
}
