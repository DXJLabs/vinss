"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getRekberV2Proof,
  getSettlementCertificate,
  type RekberV2Proof,
  type SettlementCertificateRecord,
} from "@/lib/deal-room/settlementV2";
import {
  NETWORK,
} from "@/lib/starknet/constants";
import {
  explorerUrl,
} from "@/components/room/conversation/chatFormat";

function short(value: string): string {
  return value.length > 22
    ? `${value.slice(0, 11)}…${value.slice(-9)}`
    : value;
}

function formatTime(value: number): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(
    new Date(value * 1000),
  );
}

export default function CertificatePage() {
  const params =
    useParams<{ tokenId: string }>();

  const tokenId = useMemo(
    () => params.tokenId ?? "",
    [params.tokenId],
  );

  const [record, setRecord] =
    useState<SettlementCertificateRecord | null>(
      null,
    );

  const [proof, setProof] =
    useState<RekberV2Proof | null>(null);

  const [status, setStatus] =
    useState<
      "loading" | "ready" | "missing"
    >("loading");

  useEffect(() => {
    let cancelled = false;

    setStatus("loading");
    setProof(null);

    void (async () => {
      try {
        const next =
          await getSettlementCertificate(
            BigInt(tokenId),
          );

        if (cancelled) return;

        setRecord(next);

        if (!next) {
          setStatus("missing");
          return;
        }

        setStatus("ready");

        const settlementProof =
          await getRekberV2Proof(
            next.custodyCommitment,
            "released",
          );

        if (!cancelled) {
          setProof(settlementProof);
        }
      } catch {
        if (!cancelled) {
          setStatus("missing");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  return (
    <main className="min-h-screen overflow-hidden bg-ink text-paper">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[22rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-signal/[0.055] blur-[110px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-6 sm:max-w-lg">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="font-display text-[9px] uppercase tracking-[0.18em] text-paper/35 transition hover:text-signal"
          >
            VINSS
          </Link>

          <span className="rounded-full border border-signal/15 bg-signal/[0.045] px-3 py-1.5 font-display text-[8px] uppercase tracking-[0.14em] text-signal/75">
            {NETWORK}
          </span>
        </header>

        {status === "loading" && (
          <div className="flex flex-1 items-center justify-center py-32">
            <p className="text-xs text-paper/35">
              Reading settlement…
            </p>
          </div>
        )}

        {status === "missing" && (
          <div className="flex flex-1 items-center justify-center py-32">
            <div className="w-full rounded-2xl border border-amber/25 bg-amber/[0.04] p-5 text-center">
              <p className="text-sm font-medium text-amber">
                Certificate not found
              </p>

              <p className="mt-2 text-xs leading-5 text-paper/35">
                This certificate could not be found on the configured{" "}
                {NETWORK} contract.
              </p>
            </div>
          </div>
        )}

        {record && status === "ready" && (
          <>
            <section className="pt-12 text-center">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-paper/75">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-signal text-[12px] text-ink">
                  ✓
                </span>
                Deal settled
              </div>

              <p className="mt-2 text-[11px] text-paper/32">
                {formatTime(record.settledAt)}
              </p>

              <h1 className="mt-8 text-[34px] font-medium tracking-[-0.035em] text-paper sm:text-[40px]">
                Settlement Complete
              </h1>

              <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-paper/38">
                Your VINSS Rekber settlement was completed on Starknet.
              </p>
            </section>

            <section className="relative mt-10 flex min-h-[390px] items-center justify-center">
              <div className="absolute h-72 w-72 rounded-full bg-signal/[0.11] blur-[70px]" />

              <div className="relative w-[82%] max-w-[340px] rotate-[4deg] transition duration-500 hover:rotate-0">
                <div className="absolute inset-4 rounded-[2rem] bg-signal/20 blur-[45px]" />

                <img
                  src={`/api/certificates/${tokenId}/image?v=2`}
                  alt={`VINSS Settlement Certificate #${tokenId}`}
                  className="relative w-full rounded-[22px] border border-signal/25 bg-vault shadow-[0_28px_80px_rgba(0,0,0,0.55)]"
                  style={{
                    colorScheme: "dark",
                    forcedColorAdjust: "none",
                  }}
                />
              </div>
            </section>

            <section className="mt-5 grid grid-cols-2 gap-3">
              {proof ? (
                <a
                  href={explorerUrl(
                    proof.transactionHash,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-wire/70 bg-paper/[0.025] p-4 transition hover:border-signal/30 hover:bg-signal/[0.035]"
                >
                  <div className="flex h-full min-h-[86px] flex-col justify-between">
                    <span className="text-lg text-signal">
                      ↗
                    </span>

                    <div>
                      <p className="text-sm font-medium text-paper/80">
                        View settlement
                      </p>

                      <p className="mt-1 text-[10px] text-signal/70">
                        Voyager
                      </p>
                    </div>
                  </div>
                </a>
              ) : (
                <div className="rounded-2xl border border-wire/50 bg-paper/[0.015] p-4 opacity-45">
                  <p className="text-sm text-paper/50">
                    Settlement proof
                  </p>
                </div>
              )}

              <a
                href={`/api/certificates/${tokenId}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-wire/70 bg-paper/[0.025] p-4 transition hover:border-signal/30 hover:bg-signal/[0.035]"
              >
                <div className="flex h-full min-h-[86px] flex-col justify-between">
                  <span className="text-lg text-signal">
                    ◇
                  </span>

                  <div>
                    <p className="text-sm font-medium text-paper/80">
                      Certificate data
                    </p>

                    <p className="mt-1 text-[10px] text-paper/32">
                      NFT metadata
                    </p>
                  </div>
                </div>
              </a>
            </section>

            <section className="mt-3 rounded-2xl border border-wire/65 bg-paper/[0.022] p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-signal/[0.08] text-sm text-signal">
                  ✓
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-medium text-paper/70">
                    This settlement is recorded on-chain
                  </p>

                  {proof && (
                    <p className="mt-1 truncate font-mono text-[10px] text-paper/30">
                      Tx · {short(
                        proof.transactionHash,
                      )}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-5 overflow-hidden rounded-2xl border border-wire/60 bg-paper/[0.018]">
              {[
                [
                  "Role",
                  record.role === "payer"
                    ? "Payer"
                    : "Payee",
                ],
                [
                  "Certificate owner",
                  short(record.recipient),
                ],
                [
                  "Token ID",
                  short(
                    record.tokenId.toString(),
                  ),
                ],
                [
                  "Custody proof",
                  short(
                    `0x${record.custodyCommitment.toString(
                      16,
                    )}`,
                  ),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 border-b border-wire/45 px-4 py-3.5 last:border-b-0"
                >
                  <span className="text-[10px] uppercase tracking-[0.12em] text-paper/25">
                    {label}
                  </span>

                  <span className="max-w-[58%] truncate font-mono text-[10px] text-paper/55">
                    {value}
                  </span>
                </div>
              ))}
            </section>

            <Link
              href="/rooms"
              className="mt-6 flex w-full items-center justify-center rounded-2xl bg-signal px-5 py-4 text-sm font-semibold text-ink transition hover:brightness-110"
            >
              Start new deal
              <span className="ml-2">
                →
              </span>
            </Link>

            <Link
              href="/"
              className="mx-auto mt-5 text-xs text-paper/30 underline underline-offset-4 transition hover:text-paper/65"
            >
              Back to VINSS
            </Link>

            <p className="mt-8 text-center text-[9px] leading-5 text-paper/18">
              Public certificate ownership and settlement references can be
              correlated on-chain. Private messages, Offer terms, deal notes,
              and settlement secrets remain omitted.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
