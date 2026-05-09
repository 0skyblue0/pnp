import { Package, Pencil, Plus, RefreshCcw, Trash2, UserPlus, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { apiDelete, apiGet, apiPatch, apiPost } from "../../shared/api/client.js";
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
  seasonStart: string | null;
  seasonEnd: string | null;
  isActive: boolean;
};

type StaffDto = {
  id: number;
  username: string;
  displayName: string | null;
  role: "SALES" | "PRODUCTION" | "OWNER" | null;
  isActive: boolean;
};

type DeleteResult<T> = {
  deleted: boolean;
  deactivated: boolean;
  item?: T;
};

type ProductForm = {
  name: string;
  category: string;
  isSeasonal: boolean;
  seasonStart: string;
  seasonEnd: string;
  isActive: boolean;
};

type StaffForm = {
  username: string;
  displayName: string;
  password: string;
  role: "SALES" | "PRODUCTION" | "OWNER";
  isActive: boolean;
};

const emptyProductForm: ProductForm = {
  name: "",
  category: "",
  isSeasonal: false,
  seasonStart: "",
  seasonEnd: "",
  isActive: true
};

const emptyStaffForm: StaffForm = {
  username: "",
  displayName: "",
  password: "",
  role: "SALES",
  isActive: true
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

function deleteMessage(entity: string, result: DeleteResult<unknown>) {
  return result.deactivated
    ? `${entity}는 기존 기록에서 사용 중이라 비활성 처리했습니다.`
    : `${entity} 삭제 완료`;
}

export function AdminPage() {
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [staffForm, setStaffForm] = useState<StaffForm>(emptyStaffForm);

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

  function startProductEdit(product: ProductDto) {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      category: product.category ?? "",
      isSeasonal: product.isSeasonal,
      seasonStart: product.seasonStart ?? "",
      seasonEnd: product.seasonEnd ?? "",
      isActive: product.isActive
    });
  }

  function resetProductForm() {
    setEditingProductId(null);
    setProductForm(emptyProductForm);
  }

  function startStaffEdit(person: StaffDto) {
    setEditingStaffId(person.id);
    setStaffForm({
      username: person.username,
      displayName: person.displayName ?? "",
      password: "",
      role: person.role ?? "SALES",
      isActive: person.isActive
    });
  }

  function resetStaffForm() {
    setEditingStaffId(null);
    setStaffForm(emptyStaffForm);
  }

  async function saveProduct() {
    setMessage(null);
    setError(null);

    const body = {
      name: productForm.name,
      category: productForm.category || undefined,
      isSeasonal: productForm.isSeasonal,
      seasonStart: productForm.seasonStart || undefined,
      seasonEnd: productForm.seasonEnd || undefined,
      isActive: productForm.isActive
    };
    const envelope =
      editingProductId === null
        ? await apiPost<ProductDto, Record<string, unknown>>("/product", body)
        : await apiPatch<ProductDto, Record<string, unknown>>(`/product/${editingProductId}`, body);

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(editingProductId === null ? `제품 추가: ${envelope.data.name}` : "제품 수정 완료");
    resetProductForm();
    await loadAdminData();
  }

  async function deleteProduct(product: ProductDto) {
    if (!window.confirm(`${product.name} 제품을 삭제하시겠습니까?`)) {
      return;
    }

    setMessage(null);
    setError(null);
    const envelope = await apiDelete<DeleteResult<ProductDto>>(`/product/${product.id}`);

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(deleteMessage(product.name, envelope.data));
    if (editingProductId === product.id) {
      resetProductForm();
    }
    await loadAdminData();
  }

  async function saveStaff() {
    setMessage(null);
    setError(null);

    const body = {
      ...(editingStaffId === null ? { username: staffForm.username } : {}),
      displayName: staffForm.displayName || null,
      ...(staffForm.password ? { password: staffForm.password } : {}),
      role: staffForm.role,
      isActive: staffForm.isActive
    };
    const envelope =
      editingStaffId === null
        ? await apiPost<StaffDto, Record<string, unknown>>("/staff", body)
        : await apiPatch<StaffDto, Record<string, unknown>>(`/staff/${editingStaffId}`, body);

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(editingStaffId === null ? `직원 추가: ${envelope.data.username}` : "직원 수정 완료");
    resetStaffForm();
    await loadAdminData();
  }

  async function deleteStaff(person: StaffDto) {
    if (!window.confirm(`${person.username} 직원을 삭제하시겠습니까?`)) {
      return;
    }

    setMessage(null);
    setError(null);
    const envelope = await apiDelete<DeleteResult<StaffDto>>(`/staff/${person.id}`);

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(deleteMessage(person.username, envelope.data));
    if (editingStaffId === person.id) {
      resetStaffForm();
    }
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
          <div className="grid gap-3 md:grid-cols-2">
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
            <label className="grid gap-2">
              <span className="field-label">상태</span>
              <select
                className="input"
                value={productForm.isActive ? "active" : "inactive"}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    isActive: event.target.value === "active"
                  }))
                }
              >
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
              </select>
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="field-label">시즌 시작</span>
              <input
                className="input"
                type="date"
                value={productForm.seasonStart}
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, seasonStart: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="field-label">시즌 종료</span>
              <input
                className="input"
                type="date"
                value={productForm.seasonEnd}
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, seasonEnd: event.target.value }))
                }
              />
            </label>
          </div>
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
          <div className="flex flex-wrap gap-2">
            <Button
              icon={editingProductId === null ? Plus : Pencil}
              type="button"
              onClick={() => void saveProduct()}
            >
              {editingProductId === null ? "제품 추가" : "제품 수정"}
            </Button>
            {editingProductId !== null ? (
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-stone-300 bg-white px-4 font-semibold hover:bg-stone-100"
                type="button"
                onClick={resetProductForm}
              >
                <X className="h-5 w-5" aria-hidden="true" />
                취소
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {products.map((product) => (
            <div key={product.id} className="rounded-control border border-stone-200 p-3">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{product.name}</span>
                  <span className="block truncate text-sm text-muted">
                    #{product.id} · {product.category ?? "카테고리 없음"}
                    {product.isSeasonal ? " · 시즌" : ""}
                    {product.seasonStart ? ` · ${product.seasonStart}` : ""}
                    {product.seasonEnd ? `~${product.seasonEnd}` : ""}
                  </span>
                </span>
                <span className="rounded-control bg-stone-100 px-2 py-1 text-sm font-semibold text-stone-700">
                  {product.isActive ? "활성" : "비활성"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button icon={Pencil} type="button" onClick={() => startProductEdit(product)}>
                  수정
                </Button>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-red/30 bg-white px-4 font-semibold text-red hover:bg-red/10"
                  type="button"
                  onClick={() => void deleteProduct(product)}
                >
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                  삭제
                </button>
              </div>
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
              disabled={editingStaffId !== null}
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
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="field-label">비밀번호</span>
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
            <label className="grid gap-2">
              <span className="field-label">상태</span>
              <select
                className="input"
                value={staffForm.isActive ? "active" : "inactive"}
                onChange={(event) =>
                  setStaffForm((current) => ({
                    ...current,
                    isActive: event.target.value === "active"
                  }))
                }
              >
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              icon={editingStaffId === null ? UserPlus : Pencil}
              type="button"
              onClick={() => void saveStaff()}
            >
              {editingStaffId === null ? "직원 추가" : "직원 수정"}
            </Button>
            {editingStaffId !== null ? (
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-stone-300 bg-white px-4 font-semibold hover:bg-stone-100"
                type="button"
                onClick={resetStaffForm}
              >
                <X className="h-5 w-5" aria-hidden="true" />
                취소
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {staff.map((person) => (
            <div key={person.id} className="rounded-control border border-stone-200 p-3">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {person.displayName ?? person.username}
                  </span>
                  <span className="block truncate text-sm text-muted">
                    #{person.id} · {person.username} · {roleLabel(person.role)}
                  </span>
                </span>
                <span className="rounded-control bg-blue/10 px-2 py-1 text-sm font-semibold text-blue">
                  {person.isActive ? "활성" : "비활성"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button icon={Pencil} type="button" onClick={() => startStaffEdit(person)}>
                  수정
                </Button>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-red/30 bg-white px-4 font-semibold text-red hover:bg-red/10"
                  type="button"
                  onClick={() => void deleteStaff(person)}
                >
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
