import {
  Minus,
  PackageCheck,
  PackagePlus,
  Plus,
  RefreshCcw
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { apiGet, apiPost } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { currentStoreDateTime, todayInStoreTime } from "../../shared/time/storeTime.js";
import { useConfirm } from "../../shared/ui/ConfirmDialog.js";

type OperationTab = "concierge" | "baker";
type QuantityKind = "discard" | "production";

type ProductDto = {
  id: number;
  name: string;
  isActive: boolean;
};

type StockoutDto = {
  id: string;
  productId: number;
  productName: string;
  date: string;
  sequence: number;
  stockoutAt: string;
  inquiryAfterStockout: "NONE" | "FEW" | "SOME" | "MANY" | "EXTREME" | null;
  discardQty: number;
};

type TastingLogDto = {
  id: string;
  productId: number;
  productName: string;
  recommended: boolean;
  convertedToSale: boolean | null;
  note: string | null;
};

type DailyLogDto = {
  id: string;
  date: string;
  tastingLogs: TastingLogDto[];
};

type ProductionLotDto = {
  id: string;
  productId: number;
  productName: string;
  producedAt: string;
  lotType: "AM" | "PM_2ND" | null;
  producedQty: number;
};

const tabOptions: Array<{
  value: OperationTab;
  label: string;
  icon: typeof PackageCheck;
}> = [
  { value: "concierge", label: "컨시어즈", icon: PackageCheck },
  { value: "baker", label: "베이커", icon: PackagePlus }
];

function quantityFrom(values: Record<number, string>, productId: number): number | null {
  const quantity = Number(values[productId] ?? "1");
  return Number.isInteger(quantity) && quantity >= 1 ? quantity : null;
}

function formatLiveTime(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

type QuantityControlProps = {
  label: string;
  productName: string;
  value: string;
  onChange: (value: string) => void;
  onStep: (delta: number) => void;
};

function QuantityControl({ label, productName, value, onChange, onStep }: QuantityControlProps) {
  return (
    <label className="min-w-0">
      <span className="sr-only">{label}</span>
      <div className="grid h-9 min-w-0 grid-cols-[30px_minmax(0,1fr)_30px] overflow-hidden rounded-control border border-stone-300">
        <button
          aria-label={`${productName} ${label} 감소`}
          className="grid place-items-center border-r border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
          type="button"
          onClick={() => onStep(-1)}
        >
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <input
          aria-label={`${productName} ${label}`}
          className="h-full min-w-0 border-0 px-1 text-center text-sm font-semibold outline-none"
          inputMode="numeric"
          min="1"
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          aria-label={`${productName} ${label} 증가`}
          className="grid place-items-center border-l border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
          type="button"
          onClick={() => onStep(1)}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </label>
  );
}

type CompactActionButtonProps = {
  ariaLabel: string;
  className: string;
  content: string;
  disabled: boolean;
  isNarrow?: boolean;
  onClick: () => void;
};

function CompactActionButton({
  ariaLabel,
  className,
  content,
  disabled,
  isNarrow = false,
  onClick
}: CompactActionButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      className={[
        "inline-flex items-center justify-center rounded-control font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50",
        isNarrow ? "h-9 w-11 px-0 text-base" : "h-9 min-w-0 px-2 text-base",
        className
      ].join(" ")}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden="true">{content}</span>
    </button>
  );
}

export function OperationPage() {
  const confirm = useConfirm();
  const [date] = useState(todayInStoreTime());
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState<OperationTab>("concierge");
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [stockouts, setStockouts] = useState<StockoutDto[]>([]);
  const [tastingLogs, setTastingLogs] = useState<TastingLogDto[]>([]);
  const [productionLots, setProductionLots] = useState<ProductionLotDto[]>([]);
  const [discardQuantities, setDiscardQuantities] = useState<Record<number, string>>({});
  const [productionQuantities, setProductionQuantities] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tabIds = useMemo(
    () => ({
      concierge: {
        tab: "operation-tab-concierge",
        panel: "operation-panel-concierge"
      },
      baker: {
        tab: "operation-tab-baker",
        panel: "operation-panel-baker"
      }
    }),
    []
  );

  const loadOperationData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [productEnvelope, stockoutEnvelope, dailyLogEnvelope, productionEnvelope] =
        await Promise.all([
          apiGet<ListEnvelope<ProductDto>>("/product?active=true"),
          apiGet<ListEnvelope<StockoutDto>>(`/stockout?from=${date}&to=${date}`),
          apiGet<DailyLogDto>(`/daily-log/${date}`),
          apiGet<ListEnvelope<ProductionLotDto>>(`/production-lot?date=${date}`)
        ]);

      if (productEnvelope.error) {
        setError(productEnvelope.error.message);
        return;
      }
      if (stockoutEnvelope.error) {
        setError(stockoutEnvelope.error.message);
        return;
      }
      if (dailyLogEnvelope.error) {
        setError(dailyLogEnvelope.error.message);
        return;
      }
      if (productionEnvelope.error) {
        setError(productionEnvelope.error.message);
        return;
      }

      setProducts(productEnvelope.data.items);
      setStockouts(stockoutEnvelope.data.items);
      setTastingLogs(dailyLogEnvelope.data.tastingLogs);
      setProductionLots(productionEnvelope.data.items);
    } catch (unknownError) {
      setError(
        unknownError instanceof Error ? unknownError.message : "운영 데이터를 조회하지 못했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void loadOperationData();
  }, [loadOperationData]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const discardCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const stockout of stockouts) {
      counts.set(stockout.productId, (counts.get(stockout.productId) ?? 0) + stockout.discardQty);
    }
    return counts;
  }, [stockouts]);

  const tastingCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const tasting of tastingLogs) {
      counts.set(tasting.productId, (counts.get(tasting.productId) ?? 0) + 1);
    }
    return counts;
  }, [tastingLogs]);

  const productionCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const lot of productionLots) {
      counts.set(lot.productId, (counts.get(lot.productId) ?? 0) + lot.producedQty);
    }
    return counts;
  }, [productionLots]);

  const nextStockoutSequence = useCallback(
    (productId: number) => {
      const sequence = stockouts
        .filter((stockout) => stockout.productId === productId)
        .reduce((max, stockout) => Math.max(max, stockout.sequence), 0);
      return sequence + 1;
    },
    [stockouts]
  );

  function updateQuantity(kind: QuantityKind, productId: number, value: string) {
    const setter = kind === "discard" ? setDiscardQuantities : setProductionQuantities;
    setter((current) => ({
      ...current,
      [productId]: value
    }));
  }

  function stepQuantity(kind: QuantityKind, productId: number, delta: number) {
    const setter = kind === "discard" ? setDiscardQuantities : setProductionQuantities;
    setter((current) => {
      const currentQuantity = quantityFrom(current, productId) ?? 1;
      return {
        ...current,
        [productId]: String(Math.max(1, currentQuantity + delta))
      };
    });
  }

  function confirmQuickAction(message: string): Promise<boolean> {
    return confirm({ message, confirmLabel: "저장" });
  }

  async function createStockout(product: ProductDto) {
    setMessage(null);
    setError(null);

    if (!(await confirmQuickAction(`${product.name} 품절 기록을 저장할까요?`))) {
      return;
    }

    setSavingKey(`stockout:${product.id}`);

    try {
      const envelope = await apiPost<StockoutDto, Record<string, unknown>>("/stockout", {
        productId: product.id,
        date,
        sequence: nextStockoutSequence(product.id),
        stockoutAt: currentStoreDateTime(),
        inquiryAfterStockout: "NONE",
        discardQty: 0
      });

      if (envelope.error) {
        setError(envelope.error.message);
        return;
      }

      setMessage(`${product.name} 품절 기록 저장`);
      await loadOperationData();
    } catch (unknownError) {
      setError(
        unknownError instanceof Error ? unknownError.message : "품절 기록을 저장하지 못했습니다."
      );
    } finally {
      setSavingKey(null);
    }
  }

  async function createDiscard(product: ProductDto) {
    setMessage(null);
    setError(null);

    const discardQty = quantityFrom(discardQuantities, product.id);
    if (!discardQty) {
      setError("폐기 수량은 1 이상의 정수로 입력하세요.");
      return;
    }

    if (!(await confirmQuickAction(`${product.name} 폐기 ${discardQty}개를 저장할까요?`))) {
      return;
    }

    setSavingKey(`discard:${product.id}`);
    try {
      const envelope = await apiPost<StockoutDto, Record<string, unknown>>("/discard", {
        productId: product.id,
        date,
        discardQty
      });

      if (envelope.error) {
        setError(envelope.error.message);
        return;
      }

      setMessage(`${product.name} 폐기 ${discardQty}개 저장`);
      await loadOperationData();
    } catch (unknownError) {
      setError(
        unknownError instanceof Error ? unknownError.message : "폐기 기록을 저장하지 못했습니다."
      );
    } finally {
      setSavingKey(null);
    }
  }

  async function createTasting(product: ProductDto) {
    setMessage(null);
    setError(null);

    if (!(await confirmQuickAction(`${product.name} 시식 1회를 저장할까요?`))) {
      return;
    }

    setSavingKey(`tasting:${product.id}`);

    try {
      const envelope = await apiPost<DailyLogDto, Record<string, unknown>>(
        `/daily-log/${date}/tasting`,
        {
          productId: product.id,
          recommended: false
        }
      );

      if (envelope.error) {
        setError(envelope.error.message);
        return;
      }

      setMessage(`${product.name} 시식 1회 저장`);
      await loadOperationData();
    } catch (unknownError) {
      setError(
        unknownError instanceof Error ? unknownError.message : "시식 기록을 저장하지 못했습니다."
      );
    } finally {
      setSavingKey(null);
    }
  }

  async function createProduction(product: ProductDto) {
    setMessage(null);
    setError(null);

    const producedQty = quantityFrom(productionQuantities, product.id);
    if (!producedQty) {
      setError("입고 수량은 1 이상의 정수로 입력하세요.");
      return;
    }

    if (!(await confirmQuickAction(`${product.name} 입고 ${producedQty}개를 저장할까요?`))) {
      return;
    }

    setSavingKey(`production:${product.id}`);
    try {
      const envelope = await apiPost<ProductionLotDto, Record<string, unknown>>("/production-lot", {
        productId: product.id,
        producedQty,
        producedAt: currentStoreDateTime(),
        lotType: null
      });

      if (envelope.error) {
        setError(envelope.error.message);
        return;
      }

      setMessage(`${product.name} 입고 ${producedQty}개 저장`);
      await loadOperationData();
    } catch (unknownError) {
      setError(
        unknownError instanceof Error ? unknownError.message : "입고 기록을 저장하지 못했습니다."
      );
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section className="min-w-0 rounded-panel border border-stone-200 bg-white px-3 py-2 shadow-panel">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <div className="mb-2 flex min-w-0 items-center gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted">{date} 빠른 기록</p>
                <h2 className="text-base font-semibold text-ink">운영</h2>
              </div>
              <button
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
                type="button"
                onClick={() => void loadOperationData()}
              >
                <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div aria-label="운영 유형" className="flex flex-wrap gap-1.5" role="tablist">
              {tabOptions.map((option) => {
                const Icon = option.icon;
                const isActive = activeTab === option.value;

                return (
                  <button
                    key={option.value}
                    aria-controls={tabIds[option.value].panel}
                    aria-selected={isActive}
                    className={[
                      "inline-flex min-h-8 items-center rounded-control border px-2 text-xs font-semibold",
                      isActive
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
                    ].join(" ")}
                    id={tabIds[option.value].tab}
                    role="tab"
                    type="button"
                    onClick={() => setActiveTab(option.value)}
                  >
                    <Icon className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-1.5 sm:min-w-28 sm:justify-items-end">
            <div className="text-left sm:text-right">
              <p className="text-[11px] font-semibold text-muted">현재</p>
              <p className="font-mono text-sm font-semibold text-ink">{formatLiveTime(currentTime)}</p>
            </div>
            {activeTab === "concierge" ? (
              <Link
                className="inline-flex h-8 items-center justify-center rounded-control bg-stone-900 px-3 text-xs font-semibold text-white hover:bg-stone-700"
                to="/daily-log/today"
              >
                혼잡 기록
              </Link>
            ) : null}
          </div>
        </div>

        {message ? (
          <div className="mt-2 rounded-control border border-green/20 bg-green/10 px-3 py-2 text-sm font-semibold text-green">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-2 rounded-control border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">
            {error}
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby={tabIds[activeTab].tab}
        className="min-w-0"
        id={tabIds[activeTab].panel}
        role="tabpanel"
      >
        {activeTab === "concierge" ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {products.map((product) => {
              const discardCount = discardCounts.get(product.id) ?? 0;
              const tastingCount = tastingCounts.get(product.id) ?? 0;
              const discardValue = discardQuantities[product.id] ?? "1";

              return (
                <article
                  key={product.id}
                  className="grid min-w-0 gap-2 rounded-control border border-stone-200 bg-white p-3 shadow-panel"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-ink">{product.name}</h3>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1 text-[11px] font-semibold leading-none">
                      <span className="rounded-control bg-red/10 px-2 py-1 text-red">
                        🗑 {discardCount}
                      </span>
                      <span className="rounded-control bg-amber/10 px-2 py-1 text-amber">
                        🥄 {tastingCount}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <CompactActionButton
                      ariaLabel={`${product.name} 품절 기록`}
                      className="bg-red hover:bg-red/80"
                      content="품절"
                      disabled={savingKey === `stockout:${product.id}`}
                      onClick={() => void createStockout(product)}
                    />
                    <div className="grid min-w-0 grid-cols-[92px_minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
                      <QuantityControl
                        label="폐기 수량"
                        productName={product.name}
                        value={discardValue}
                        onChange={(value) => updateQuantity("discard", product.id, value)}
                        onStep={(delta) => stepQuantity("discard", product.id, delta)}
                      />
                      <CompactActionButton
                        ariaLabel={`${product.name} 폐기 기록`}
                        className="bg-stone-800 hover:bg-stone-700"
                        content="🗑"
                        disabled={savingKey === `discard:${product.id}`}
                        onClick={() => void createDiscard(product)}
                      />
                      <CompactActionButton
                        ariaLabel={`${product.name} 시식 기록`}
                        className="bg-amber hover:bg-amber/80"
                        content="🥄"
                        disabled={savingKey === `tasting:${product.id}`}
                        onClick={() => void createTasting(product)}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
            {!isLoading && products.length === 0 ? (
              <div className="rounded-panel border border-stone-200 bg-white px-3 py-8 text-center text-sm font-medium text-muted">
                활성 제품 없음
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {products.map((product) => {
              const producedCount = productionCounts.get(product.id) ?? 0;
              const productionValue = productionQuantities[product.id] ?? "1";

              return (
                <article
                  key={product.id}
                  className="grid min-w-0 gap-2 rounded-control border border-stone-200 bg-white p-3 shadow-panel"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-ink">{product.name}</h3>
                    </div>
                    <span className="shrink-0 rounded-control bg-blue/10 px-2 py-1 text-[11px] font-semibold leading-none text-blue">
                      📥 {producedCount}
                    </span>
                  </div>

                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_44px] gap-1.5">
                    <QuantityControl
                      label="입고 수량"
                      productName={product.name}
                      value={productionValue}
                      onChange={(value) => updateQuantity("production", product.id, value)}
                      onStep={(delta) => stepQuantity("production", product.id, delta)}
                    />
                    <CompactActionButton
                      ariaLabel={`${product.name} 입고 기록`}
                      className="bg-blue hover:bg-blue/80"
                      content="📥"
                      disabled={savingKey === `production:${product.id}`}
                      isNarrow
                      onClick={() => void createProduction(product)}
                    />
                  </div>
                </article>
              );
            })}
            {!isLoading && products.length === 0 ? (
              <div className="rounded-panel border border-stone-200 bg-white px-3 py-8 text-center text-sm font-medium text-muted">
                활성 제품 없음
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
