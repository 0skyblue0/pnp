import { Package, Plus, RefreshCcw, UserPlus, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { apiGet, apiPost } from "../../shared/api/client.js";
import { Button } from "../../shared/ui/Button.js";

type ListEnvelope<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
};

type ProductDto = {
  id: number;
  name: string;
  category: string | null;
  isSeasonal: boolean;
  isActive: boolean;
};

type StaffDto = {
  id: number;
  username: string;
  displayName: string | null;
  role: "SALES" | "PRODUCTION" | "OWNER" | null;
  isActive: boolean;
};

type ProductForm = {
  name: string;
  category: string;
  isSeasonal: boolean;
};

type StaffForm = {
  username: string;
  displayName: string;
  password: string;
  role: "SALES" | "PRODUCTION" | "OWNER";
};

function roleLabel(role: StaffDto["role"]): string {
  if (role === "OWNER") {
    return "대표";
  }
  if (role === "PRODUCTION") {
    return "생산";
  }
  return "판매";
}

export function StaffPage() {
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>({
    name: "",
    category: "",
    isSeasonal: false
  });
  const [staffForm, setStaffForm] = useState<StaffForm>({
    username: "",
    displayName: "",
    password: "",
    role: "SALES"
  });

  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const [productEnvelope, staffEnvelope] = await Promise.all([
      apiGet<ListEnvelope<ProductDto>>("/product"),
      apiGet<ListEnvelope<StaffDto>>("/staff")
    ]);

    setIsLoading(false);

    if (productEnvelope.error) {
      setError(productEnvelope.error.message);
      return;
    }
    if (staffEnvelope.error) {
      setError(staffEnvelope.error.message);
      return;
    }

    setProducts(productEnvelope.data.items);
    setStaff(staffEnvelope.data.items);
  }, []);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  async function createProduct() {
    setMessage(null);
    setError(null);

    const envelope = await apiPost<ProductDto, Record<string, unknown>>("/product", {
      name: productForm.name,
      category: productForm.category || undefined,
      isSeasonal: productForm.isSeasonal,
      isActive: true
    });

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(`제품 추가: ${envelope.data.name}`);
    setProductForm({ name: "", category: "", isSeasonal: false });
    await loadAdminData();
  }

  async function createStaff() {
    setMessage(null);
    setError(null);

    const envelope = await apiPost<StaffDto, Record<string, unknown>>("/staff", {
      username: staffForm.username,
      displayName: staffForm.displayName || undefined,
      password: staffForm.password,
      role: staffForm.role,
      isActive: true
    });

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(`직원 추가: ${envelope.data.username}`);
    setStaffForm({ username: "", displayName: "", password: "", role: "SALES" });
    await loadAdminData();
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4 xl:grid-cols-2">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">관리</p>
            <h2 className="section-title">제품 마스터</h2>
          </div>
          <Package className="h-5 w-5 text-bread" aria-hidden="true" />
        </div>

        {message ? (
          <div className="mb-4 rounded-control border border-green/20 bg-green/10 px-3 py-2 text-sm font-semibold text-green">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-control border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3">
          <label className="grid gap-2">
            <span className="field-label">제품명</span>
            <input
              className="input"
              value={productForm.name}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </label>
          <label className="grid gap-2">
            <span className="field-label">카테고리</span>
            <input
              className="input"
              value={productForm.category}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, category: event.target.value }))
              }
            />
          </label>
          <label className="inline-flex min-h-11 items-center gap-3 rounded-control border border-stone-300 px-3 font-semibold">
            <input
              className="h-5 w-5 accent-stone-900"
              type="checkbox"
              checked={productForm.isSeasonal}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, isSeasonal: event.target.checked }))
              }
            />
            시즌 제품
          </label>
          <Button icon={Plus} type="button" onClick={() => void createProduct()}>
            제품 추가
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {products.map((product) => (
            <div
              key={product.id}
              className="grid min-h-12 grid-cols-[1fr_auto] items-center gap-3 rounded-control border border-stone-200 px-3"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{product.name}</span>
                <span className="block truncate text-sm text-muted">
                  {product.category ?? "카테고리 없음"}
                </span>
              </span>
              <span className="rounded-control bg-stone-100 px-2 py-1 text-sm font-semibold text-stone-700">
                {product.isActive ? "활성" : "비활성"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">계정</p>
            <h2 className="section-title">직원</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button icon={RefreshCcw} type="button" onClick={() => void loadAdminData()}>
              {isLoading ? "조회 중" : "새로고침"}
            </Button>
            <UsersRound className="h-5 w-5 text-blue" aria-hidden="true" />
          </div>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-2">
            <span className="field-label">아이디</span>
            <input
              className="input"
              value={staffForm.username}
              onChange={(event) =>
                setStaffForm((current) => ({ ...current, username: event.target.value }))
              }
            />
          </label>
          <label className="grid gap-2">
            <span className="field-label">표시명</span>
            <input
              className="input"
              value={staffForm.displayName}
              onChange={(event) =>
                setStaffForm((current) => ({ ...current, displayName: event.target.value }))
              }
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="field-label">초기 비밀번호</span>
              <input
                className="input"
                type="password"
                value={staffForm.password}
                onChange={(event) =>
                  setStaffForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="field-label">역할</span>
              <select
                className="input"
                value={staffForm.role}
                onChange={(event) =>
                  setStaffForm((current) => ({
                    ...current,
                    role: event.target.value as StaffForm["role"]
                  }))
                }
              >
                <option value="SALES">판매</option>
                <option value="PRODUCTION">생산</option>
                <option value="OWNER">대표</option>
              </select>
            </label>
          </div>
          <Button icon={UserPlus} type="button" onClick={() => void createStaff()}>
            직원 추가
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {staff.map((person) => (
            <div
              key={person.id}
              className="grid min-h-12 grid-cols-[1fr_auto] items-center gap-3 rounded-control border border-stone-200 px-3"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {person.displayName ?? person.username}
                </span>
                <span className="block truncate text-sm text-muted">{person.username}</span>
              </span>
              <span className="rounded-control bg-blue/10 px-2 py-1 text-sm font-semibold text-blue">
                {roleLabel(person.role)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
