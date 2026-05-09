import { Pencil, Plus, RefreshCcw, Trash2, UserPlus, X } from "lucide-react";
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

function statusBadge(isActive: boolean) {
  return [
    "inline-flex min-h-8 items-center rounded-control px-2 text-sm font-semibold",
    isActive ? "bg-green/10 text-green" : "bg-stone-100 text-muted"
  ].join(" ");
}

export function ManagementPage() {
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [isStaffFormOpen, setIsStaffFormOpen] = useState(false);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [staffForm, setStaffForm] = useState<StaffForm>(emptyStaffForm);

  const loadManagementData = useCallback(async () => {
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
    void loadManagementData();
  }, [loadManagementData]);

  function openNewProductForm() {
    setEditingProductId(null);
    setProductForm(emptyProductForm);
    setIsProductFormOpen(true);
  }

  function openProductEdit(product: ProductDto) {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      category: product.category ?? "",
      isSeasonal: product.isSeasonal,
      seasonStart: product.seasonStart ?? "",
      seasonEnd: product.seasonEnd ?? "",
      isActive: product.isActive
    });
    setIsProductFormOpen(true);
  }

  function closeProductForm() {
    setEditingProductId(null);
    setProductForm(emptyProductForm);
    setIsProductFormOpen(false);
  }

  function openNewStaffForm() {
    setEditingStaffId(null);
    setStaffForm(emptyStaffForm);
    setIsStaffFormOpen(true);
  }

  function openStaffEdit(person: StaffDto) {
    setEditingStaffId(person.id);
    setStaffForm({
      username: person.username,
      displayName: person.displayName ?? "",
      password: "",
      role: person.role ?? "SALES",
      isActive: person.isActive
    });
    setIsStaffFormOpen(true);
  }

  function closeStaffForm() {
    setEditingStaffId(null);
    setStaffForm(emptyStaffForm);
    setIsStaffFormOpen(false);
  }

  async function saveProduct() {
    setMessage(null);
    setError(null);

    const createBody = {
      name: productForm.name,
      category: productForm.category || undefined,
      isSeasonal: productForm.isSeasonal,
      seasonStart: productForm.seasonStart || undefined,
      seasonEnd: productForm.seasonEnd || undefined,
      isActive: productForm.isActive
    };
    const updateBody = {
      name: productForm.name,
      category: productForm.category || null,
      isSeasonal: productForm.isSeasonal,
      seasonStart: productForm.seasonStart || null,
      seasonEnd: productForm.seasonEnd || null,
      isActive: productForm.isActive
    };
    const envelope =
      editingProductId === null
        ? await apiPost<ProductDto, Record<string, unknown>>("/product", createBody)
        : await apiPatch<ProductDto, Record<string, unknown>>(
            `/product/${editingProductId}`,
            updateBody
          );

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(editingProductId === null ? `제품 추가: ${envelope.data.name}` : "제품 수정 완료");
    closeProductForm();
    await loadManagementData();
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
      closeProductForm();
    }
    await loadManagementData();
  }

  async function saveStaff() {
    setMessage(null);
    setError(null);

    const username = staffForm.username.trim();
    const displayName = staffForm.displayName.trim();
    const password = staffForm.password;

    if (editingStaffId === null && username.length === 0) {
      setError("직원 아이디를 입력하세요.");
      return;
    }
    if (editingStaffId === null && password.length < 8) {
      setError("초기 비밀번호를 8자 이상 입력하세요.");
      return;
    }
    if (editingStaffId !== null && password.length > 0 && password.length < 8) {
      setError("비밀번호를 변경하려면 8자 이상 입력하세요.");
      return;
    }

    const body =
      editingStaffId === null
        ? {
            username,
            ...(displayName ? { displayName } : {}),
            password,
            role: staffForm.role,
            isActive: staffForm.isActive
          }
        : {
            displayName: displayName || null,
            ...(password ? { password } : {}),
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
    closeStaffForm();
    await loadManagementData();
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
      closeStaffForm();
    }
    await loadManagementData();
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">관리</p>
            <h2 className="section-title">기준 정보</h2>
          </div>
          <Button icon={RefreshCcw} type="button" onClick={() => void loadManagementData()}>
            {isLoading ? "조회 중" : "새로고침"}
          </Button>
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-control border border-stone-200 px-3 py-3">
            <p className="text-sm text-muted">제품</p>
            <p className="mt-1 text-2xl font-semibold">{products.length}</p>
          </div>
          <div className="rounded-control border border-stone-200 px-3 py-3">
            <p className="text-sm text-muted">활성 제품</p>
            <p className="mt-1 text-2xl font-semibold">
              {products.filter((product) => product.isActive).length}
            </p>
          </div>
          <div className="rounded-control border border-stone-200 px-3 py-3">
            <p className="text-sm text-muted">직원</p>
            <p className="mt-1 text-2xl font-semibold">{staff.length}</p>
          </div>
          <div className="rounded-control border border-stone-200 px-3 py-3">
            <p className="text-sm text-muted">활성 직원</p>
            <p className="mt-1 text-2xl font-semibold">
              {staff.filter((person) => person.isActive).length}
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">제품 마스터</p>
            <h2 className="section-title">제품 조회</h2>
          </div>
          <Button icon={Plus} type="button" onClick={openNewProductForm}>
            제품 추가
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-muted">
              <tr>
                <th className="py-3 pr-4 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">제품</th>
                <th className="px-4 py-3 font-medium">카테고리</th>
                <th className="px-4 py-3 font-medium">시즌</th>
                <th className="px-4 py-3 font-medium">기간</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="py-3 pl-4 font-medium">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="py-3 pr-4 font-semibold">{product.id}</td>
                  <td className="px-4 py-3 font-semibold">{product.name}</td>
                  <td className="px-4 py-3">{product.category ?? "-"}</td>
                  <td className="px-4 py-3">{product.isSeasonal ? "시즌" : "-"}</td>
                  <td className="px-4 py-3">
                    {product.seasonStart ?? "-"} {product.seasonEnd ? `~ ${product.seasonEnd}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(product.isActive)}>
                      {product.isActive ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="py-3 pl-4">
                    <div className="flex gap-2">
                      <button
                        className="inline-flex min-h-9 items-center justify-center gap-1 rounded-control border border-stone-300 bg-white px-3 font-semibold hover:bg-stone-100"
                        type="button"
                        onClick={() => openProductEdit(product)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        수정
                      </button>
                      <button
                        className="inline-flex min-h-9 items-center justify-center gap-1 rounded-control border border-red/30 bg-white px-3 font-semibold text-red hover:bg-red/10"
                        type="button"
                        onClick={() => void deleteProduct(product)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && products.length === 0 ? (
            <div className="rounded-control border border-stone-200 px-3 py-6 text-center text-sm font-medium text-muted">
              등록 제품 없음
            </div>
          ) : null}
        </div>

        {isProductFormOpen ? (
          <div className="mt-4 grid gap-3 border-t border-stone-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">
                {editingProductId === null ? "제품 추가" : `제품 수정 #${editingProductId}`}
              </h3>
              <button
                className="inline-flex min-h-9 items-center justify-center rounded-control border border-stone-300 bg-white px-3 font-semibold hover:bg-stone-100"
                type="button"
                onClick={closeProductForm}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
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
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
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
              <label className="mt-7 inline-flex min-h-11 items-center gap-3 rounded-control border border-stone-300 px-3 font-semibold">
                <input
                  className="h-5 w-5 accent-stone-900"
                  type="checkbox"
                  checked={productForm.isSeasonal}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      isSeasonal: event.target.checked
                    }))
                  }
                />
                시즌 제품
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                icon={editingProductId === null ? Plus : Pencil}
                type="button"
                onClick={() => void saveProduct()}
              >
                {editingProductId === null ? "추가" : "저장"}
              </Button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-stone-300 bg-white px-4 font-semibold hover:bg-stone-100"
                type="button"
                onClick={closeProductForm}
              >
                취소
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">계정</p>
            <h2 className="section-title">직원 조회</h2>
          </div>
          <Button icon={UserPlus} type="button" onClick={openNewStaffForm}>
            직원 추가
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-muted">
              <tr>
                <th className="py-3 pr-4 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">아이디</th>
                <th className="px-4 py-3 font-medium">표시명</th>
                <th className="px-4 py-3 font-medium">역할</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="py-3 pl-4 font-medium">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {staff.map((person) => (
                <tr key={person.id}>
                  <td className="py-3 pr-4 font-semibold">{person.id}</td>
                  <td className="px-4 py-3 font-semibold">{person.username}</td>
                  <td className="px-4 py-3">{person.displayName ?? "-"}</td>
                  <td className="px-4 py-3">{roleLabel(person.role)}</td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(person.isActive)}>
                      {person.isActive ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="py-3 pl-4">
                    <div className="flex gap-2">
                      <button
                        className="inline-flex min-h-9 items-center justify-center gap-1 rounded-control border border-stone-300 bg-white px-3 font-semibold hover:bg-stone-100"
                        type="button"
                        onClick={() => openStaffEdit(person)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        수정
                      </button>
                      <button
                        className="inline-flex min-h-9 items-center justify-center gap-1 rounded-control border border-red/30 bg-white px-3 font-semibold text-red hover:bg-red/10"
                        type="button"
                        onClick={() => void deleteStaff(person)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && staff.length === 0 ? (
            <div className="rounded-control border border-stone-200 px-3 py-6 text-center text-sm font-medium text-muted">
              등록 직원 없음
            </div>
          ) : null}
        </div>

        {isStaffFormOpen ? (
          <div className="mt-4 grid gap-3 border-t border-stone-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">
                {editingStaffId === null ? "직원 추가" : `직원 수정 #${editingStaffId}`}
              </h3>
              <button
                className="inline-flex min-h-9 items-center justify-center rounded-control border border-stone-300 bg-white px-3 font-semibold hover:bg-stone-100"
                type="button"
                onClick={closeStaffForm}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
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
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
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
                {editingStaffId === null ? "추가" : "저장"}
              </Button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-stone-300 bg-white px-4 font-semibold hover:bg-stone-100"
                type="button"
                onClick={closeStaffForm}
              >
                취소
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
