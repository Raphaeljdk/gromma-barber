"use client";

import { useMemo, useState } from "react";
import { buildGrommaPagCandles, type GrommaPagPeriod, type PaidClubReceipt } from "@/lib/gromma-pag-series";
import styles from "./gromma-pag-dashboard.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactMoney = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export function GrommaPagCandles({ receipts }: { receipts: PaidClubReceipt[] }) {
  const [period, setPeriod] = useState<GrommaPagPeriod>("mes");
  const candles = useMemo(() => buildGrommaPagCandles(receipts, period), [receipts, period]);
  const hasActivity = candles.some(candle => candle.count > 0);
  const max = Math.max(1, ...candles.map(candle => candle.high));
  const ceiling = max * 1.12;
  const width = 980, height = 312, top = 22, bottom = 263, left = 78, right = 14;
  const availableHeight = bottom - top;
  const plotWidth = width - left - right;
  const step = plotWidth / candles.length;
  const candleWidth = Math.min(32, step * 0.48);
  const y = (value: number) => bottom - (value / ceiling) * availableHeight;
  const periods: { id: GrommaPagPeriod; label: string }[] = [
    { id: "mes", label: "Mês" }, { id: "semana", label: "Semana" }, { id: "dia", label: "Dia" },
  ];

  return (
    <section className={styles.chartCard} aria-label="Gráfico de velas do Gromma Pag">
      <header className={styles.chartHeader}>
        <div>
          <h3>Recebimentos do clube</h3>
          <p>Gráfico de velas com pagamentos confirmados</p>
        </div>
        <div className={styles.periodTabs} role="group" aria-label="Visualizar recebimentos por período">
          {periods.map(item => (
            <button key={item.id} type="button" className={period === item.id ? styles.selectedTab : styles.periodTab}
              aria-pressed={period === item.id} onClick={() => setPeriod(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </header>
      {hasActivity ? (
        <div className={styles.chartScroll}>
          <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img"
            aria-label={`Velas dos recebimentos confirmados por ${period === "mes" ? "mês" : period === "semana" ? "semana" : "dia"}`}>
            {[0, 1, 2, 3, 4].map(tick => {
              const value = (ceiling * tick) / 4;
              const position = y(value);
              return <g key={tick}>
                <line x1={left} x2={width - right} y1={position} y2={position} className={styles.gridLine} />
                <text x={left - 12} y={position + 4} textAnchor="end" className={styles.axisText}>
                  {compactMoney.format(value)}
                </text>
              </g>;
            })}
            {candles.map((candle, index) => {
              const center = left + step * (index + 0.5);
              const up = candle.close >= candle.open;
              const fill = up ? styles.candleUp : styles.candleDown;
              const bodyTop = y(Math.max(candle.open, candle.close));
              const bodyBottom = y(Math.min(candle.open, candle.close));
              const bodyHeight = Math.max(3, bodyBottom - bodyTop);
              const description = `${candle.periodLabel}: total ${money.format(candle.total)}. Abertura ${money.format(candle.open)}; máxima ${money.format(candle.high)}; mínima ${money.format(candle.low)}; fechamento ${money.format(candle.close)}.`;
              return <g key={candle.key} className={fill}>
                <title>{description}</title>
                <line x1={center} x2={center} y1={y(candle.high)} y2={y(candle.low)} strokeWidth="2" />
                <rect x={center - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} rx="3" />
                <text x={center} y={height - 26} textAnchor="middle" className={styles.axisText}>{candle.label}</text>
              </g>;
            })}
          </svg>
        </div>
      ) : (
        <p className={styles.noData}>Nenhum recebimento confirmado nos períodos exibidos. O gráfico será preenchido quando houver pagamentos registrados.</p>
      )}
      <footer className={styles.chartFoot}>
        <span><i className={styles.upKey} /> Fechamento maior ou igual à abertura</span>
        <span><i className={styles.downKey} /> Fechamento menor que a abertura</span>
      </footer>
      <p className={styles.chartNote}>Cada vela resume recebimentos por hora (dia) ou por dia (semana e mês). Abertura e fechamento são os valores da primeira e última subdivisão; máxima e mínima são os extremos. Não representa cotação de mercado.</p>
    </section>
  );
}
