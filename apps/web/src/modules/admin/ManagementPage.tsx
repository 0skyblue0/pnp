import { Pencil, Plus, RefreshCcw, Trash2, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { apiDelete, apiGet, apiPatch, apiPost } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { Button } from "../../shared/ui/Button.js";

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

type ResponseCriterionDto = {
  id: number;
  parentId: number | null;
  depth: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type AnnualGoalNoticeCategory = "sales" | "operation" | "staff";

type AnnualGoalNoticeDto = {
  id: string;
  category: AnnualGoalNoticeCategory;
  title: string;
  value: string;
  note: string;
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

type CriterionForm = {
  name: string;
  sortOrder: string;
  isActive: boolean;
};

type GoalNoticeForm = {
  category: AnnualGoalNoticeCategory;
  title: string;
  value: string;
  note: string;
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

const emptyCriterionForm: CriterionForm = {
  name: "",
  sortOrder: "0",
  isActive: true
};

const emptyGoalNoticeForm: GoalNoticeForm = {
  category: "sales",
  title: "",
  value: "",
  note: ""
};

const goalNoticeCategoryLabels: Record<AnnualGoalNoticeCategory, string> = {
  sales: "매출 목표",
  operation: "운영 목표",
  staff: "직원 공지"
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

function criteriaByParent(criteria: ResponseCriterionDto[], parentId: number | null) {
  return criteria
    .filter((criterion) => criterion.parentId === parentId)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}

function criterionLevelLabel(depth: number) {
  if (depth === 1) {
    return "대분류";
  }
  if (depth === 2) {
    return "중분류";
  }
  return "소분류";
}

function criterionRowClass(isSelected: boolean) {
  return [
    "grid gap-2 rounded-control border px-3 py-3 text-sm sm:grid-cols-[1fr_auto]",
    isSelected ? "border-stone-900 bg-stone-100" : "border-stone-200 bg-white"
  ].join(" ");
}

export function ManagementPage() {
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [responseCriteria, setResponseCriteria] = useState<ResponseCriterionDto[]>([]);
  const [goalNotices, setGoalNotices] = useState<AnnualGoalNoticeDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [editingCriterionId, setEditingCriterionId] = useState<number | null>(null);
  const [editingGoalNoticeId, setEditingGoalNoticeId] = useState<string | null>(null);
  const [selectedMajorId, setSelectedMajorId] = useState<number | null>(null);
  const [selectedMiddleId, setSelectedMiddleId] = useState<number | null>(null);
  const [criterionParentId, setCriterionParentId] = useState<number | null>(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [isStaffFormOpen, setIsStaffFormOpen] = useState(false);
  const [isCriterionFormOpen, setIsCriterionFormOpen] = useState(false);
  const [isGoalNoticeFormOpen, setIsGoalNoticeFormOpen] = useState(false);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [staffForm, setStaffForm] = useState<StaffForm>(emptyStaffForm);
  const [criterionForm, setCriterionForm] = useState<CriterionForm>(emptyCriterionForm);
  const [goalNoticeForm, setGoalNoticeForm] = useState<GoalNoticeForm>(emptyGoalNoticeForm);

  const loadManagementData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const [productEnvelope, staffEnvelope, criterionEnvelope, goalNoticeEnvelope] =
      await Promise.all([
        apiGet<ListEnvelope<ProductDto>>("/product"),
        apiGet<ListEnvelope<StaffDto>>("/staff"),
        apiGet<ListEnvelope<ResponseCriterionDto>>("/response-criteria"),
        apiGet<ListEnvelope<AnnualGoalNoticeDto>>("/annual-goal-notice")
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
    if (criterionEnvelope.error) {
      setError(criterionEnvelope.error.message);
      return;
    }
    if (goalNoticeEnvelope.error) {
      setError(goalNoticeEnvelope.error.message);
      return;
    }

    setProducts(productEnvelope.data.items);
    setStaff(staffEnvelope.data.items);
    setResponseCriteria(criterionEnvelope.data.items);
    setGoalNotices(goalNoticeEnvelope.data.items);
  }, []);

  useEffect(() => {
    void loadManagementData();
  }, [loadManagementData]);

  useEffect(() => {
    if (
      selectedMajorId !== null &&
      !responseCriteria.some(
        (criterion) => criterion.id === selectedMajorId && criterion.depth === 1
      )
    ) {
      setSelectedMajorId(null);
      setSelectedMiddleId(null);
      return;
    }

    if (
      selectedMiddleId !== null &&
      !responseCriteria.some(
        (criterion) =>
          criterion.id === selectedMiddleId &&
          criterion.depth === 2 &&
          criterion.parentId === selectedMajorId
      )
    ) {
      setSelectedMiddleId(null);
    }
  }, [responseCriteria, selectedMajorId, selectedMiddleId]);

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

  function nextCriterionSortOrder(parentId: number | null) {
    const siblings = criteriaByParent(responseCriteria, parentId);
    if (siblings.length === 0) {
      return 10;
    }

    return Math.max(...siblings.map((criterion) => criterion.sortOrder)) + 10;
  }

  function openNewCriterionForm(parentId: number | null) {
    setEditingCriterionId(null);
    setCriterionParentId(parentId);
    setCriterionForm({
      ...emptyCriterionForm,
      sortOrder: String(nextCriterionSortOrder(parentId))
    });
    setIsCriterionFormOpen(true);
  }

  function openCriterionEdit(criterion: ResponseCriterionDto) {
    if (criterion.depth === 1) {
      setSelectedMajorId(criterion.id);
      setSelectedMiddleId(null);
    }
    if (criterion.depth === 2) {
      setSelectedMajorId(criterion.parentId);
      setSelectedMiddleId(criterion.id);
    }
    if (criterion.depth === 3) {
      const middle = responseCriteria.find((item) => item.id === criterion.parentId);
      setSelectedMajorId(middle?.parentId ?? null);
      setSelectedMiddleId(criterion.parentId);
    }

    setEditingCriterionId(criterion.id);
    setCriterionParentId(criterion.parentId);
    setCriterionForm({
      name: criterion.name,
      sortOrder: String(criterion.sortOrder),
      isActive: criterion.isActive
    });
    setIsCriterionFormOpen(true);
  }

  function closeCriterionForm() {
    setEditingCriterionId(null);
    setCriterionParentId(null);
    setCriterionForm(emptyCriterionForm);
    setIsCriterionFormOpen(false);
  }

  function openNewGoalNoticeForm() {
    setEditingGoalNoticeId(null);
    setGoalNoticeForm(emptyGoalNoticeForm);
    setIsGoalNoticeFormOpen(true);
  }

  function openGoalNoticeEdit(notice: AnnualGoalNoticeDto) {
    setEditingGoalNoticeId(notice.id);
    setGoalNoticeForm({
      category: notice.category,
      title: notice.title,
      value: notice.value,
      note: notice.note
    });
    setIsGoalNoticeFormOpen(true);
  }

  function closeGoalNoticeForm() {
    setEditingGoalNoticeId(null);
    setGoalNoticeForm(emptyGoalNoticeForm);
    setIsGoalNoticeFormOpen(false);
  }

  function selectMajorCriterion(id: number) {
    setSelectedMajorId(id);
    setSelectedMiddleId(null);
  }

  function selectMiddleCriterion(id: number) {
    setSelectedMiddleId(id);
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

  async function saveGoalNotice() {
    setMessage(null);
    setError(null);

    const title = goalNoticeForm.title.trim();
    const value = goalNoticeForm.value.trim();
    const note = goalNoticeForm.note.trim();

    if (!title || !value) {
      setError("공지 제목과 내용을 입력하세요.");
      return;
    }

    const body = { category: goalNoticeForm.category, title, value, note };
    const envelope =
      editingGoalNoticeId === null
        ? await apiPost<AnnualGoalNoticeDto, Record<string, unknown>>("/annual-goal-notice", body)
        : await apiPatch<AnnualGoalNoticeDto, Record<string, unknown>>(
            `/annual-goal-notice/${editingGoalNoticeId}`,
            body
          );

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(
      editingGoalNoticeId === null ? `홈 공지 추가: ${envelope.data.title}` : "홈 공지 수정 완료"
    );
    closeGoalNoticeForm();
    await loadManagementData();
  }

  async function deleteGoalNotice(notice: AnnualGoalNoticeDto) {
    if (!window.confirm(`${notice.title} 홈 공지를 삭제하시겠습니까?`)) {
      return;
    }

    setMessage(null);
    setError(null);
    const envelope = await apiDelete<{ deleted: boolean }>(`/annual-goal-notice/${notice.id}`);

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage("홈 공지 삭제 완료");
    if (editingGoalNoticeId === notice.id) {
      closeGoalNoticeForm();
    }
    await loadManagementData();
  }

  async function saveCriterion() {
    setMessage(null);
    setError(null);

    const name = criterionForm.name.trim();
    const sortOrder = Number(criterionForm.sortOrder);

    if (name.length === 0) {
      setError("반응 기준명을 입력하세요.");
      return;
    }
    if (!Number.isInteger(sortOrder)) {
      setError("정렬 순서는 정수로 입력하세요.");
      return;
    }

    const body = {
      name,
      sortOrder,
      isActive: criterionForm.isActive
    };
    const envelope =
      editingCriterionId === null
        ? await apiPost<ResponseCriterionDto, Record<string, unknown>>("/response-criteria", {
            ...body,
            parentId: criterionParentId
          })
        : await apiPatch<ResponseCriterionDto, Record<string, unknown>>(
            `/response-criteria/${editingCriterionId}`,
            body
          );

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    const savedCriterion = envelope.data;
    setMessage(
      editingCriterionId === null
        ? `${criterionLevelLabel(savedCriterion.depth)} 추가: ${savedCriterion.name}`
        : "반응 기준 수정 완료"
    );
    closeCriterionForm();
    await loadManagementData();

    if (savedCriterion.depth === 1) {
      setSelectedMajorId(savedCriterion.id);
      setSelectedMiddleId(null);
    }
    if (savedCriterion.depth === 2) {
      setSelectedMajorId(savedCriterion.parentId);
      setSelectedMiddleId(savedCriterion.id);
    }
    if (savedCriterion.depth === 3) {
      const middle = responseCriteria.find((criterion) => criterion.id === savedCriterion.parentId);
      setSelectedMajorId(middle?.parentId ?? selectedMajorId);
      setSelectedMiddleId(savedCriterion.parentId);
    }
  }

  async function toggleCriterionStatus(criterion: ResponseCriterionDto) {
    const nextActive = !criterion.isActive;
    if (!nextActive && !window.confirm(`${criterion.name} 반응 기준을 비활성 처리하시겠습니까?`)) {
      return;
    }

    setMessage(null);
    setError(null);
    const envelope = await apiPatch<ResponseCriterionDto, Record<string, unknown>>(
      `/response-criteria/${criterion.id}`,
      { isActive: nextActive }
    );

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(`${criterion.name} ${nextActive ? "활성화" : "비활성화"} 완료`);
    await loadManagementData();
  }

  async function deleteCriterion(criterion: ResponseCriterionDto) {
    if (!window.confirm(`${criterion.name} 반응 기준을 삭제하시겠습니까?`)) {
      return;
    }

    setMessage(null);
    setError(null);
    const envelope = await apiDelete<DeleteResult<ResponseCriterionDto>>(
      `/response-criteria/${criterion.id}`
    );

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(deleteMessage(criterion.name, envelope.data));
    if (editingCriterionId === criterion.id) {
      closeCriterionForm();
    }
    await loadManagementData();
  }

  const majorCriteria = criteriaByParent(responseCriteria, null);
  const middleCriteria =
    selectedMajorId === null ? [] : criteriaByParent(responseCriteria, selectedMajorId);
  const minorCriteria =
    selectedMiddleId === null ? [] : criteriaByParent(responseCriteria, selectedMiddleId);
  const selectedMajor = majorCriteria.find((criterion) => criterion.id === selectedMajorId);
  const selectedMiddle = middleCriteria.find((criterion) => criterion.id === selectedMiddleId);
  const editingCriterion = responseCriteria.find(
    (criterion) => criterion.id === editingCriterionId
  );
  const criterionFormParent =
    criterionParentId === null
      ? null
      : responseCriteria.find((criterion) => criterion.id === criterionParentId);
  const criterionFormDepth =
    editingCriterion?.depth ?? (criterionFormParent ? criterionFormParent.depth + 1 : 1);

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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
          <div className="rounded-control border border-stone-200 px-3 py-3">
            <p className="text-sm text-muted">반응 기준</p>
            <p className="mt-1 text-2xl font-semibold">{responseCriteria.length}</p>
          </div>
          <div className="rounded-control border border-stone-200 px-3 py-3">
            <p className="text-sm text-muted">활성 기준</p>
            <p className="mt-1 text-2xl font-semibold">
              {responseCriteria.filter((criterion) => criterion.isActive).length}
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">홈 화면</p>
            <h2 className="section-title">홈 목표·매출 공지 관리</h2>
          </div>
          <Button icon={Plus} type="button" onClick={openNewGoalNoticeForm}>
            홈 공지 추가
          </Button>
        </div>

        {isGoalNoticeFormOpen ? (
          <div className="mb-4 rounded-control border border-stone-200 bg-cream/60 p-4">
            <div className="grid gap-3 lg:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]">
              <label className="grid gap-2">
                <span className="field-label">공지 종류</span>
                <select
                  className="input"
                  aria-label="공지 종류"
                  value={goalNoticeForm.category}
                  onChange={(event) =>
                    setGoalNoticeForm((current) => ({
                      ...current,
                      category: event.target.value as AnnualGoalNoticeCategory
                    }))
                  }
                >
                  <option value="sales">매출 목표</option>
                  <option value="operation">운영 목표</option>
                  <option value="staff">직원 공지</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="field-label">공지 제목</span>
                <input
                  className="input"
                  aria-label="공지 제목"
                  value={goalNoticeForm.title}
                  onChange={(event) =>
                    setGoalNoticeForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className="field-label">공지 내용</span>
                <input
                  className="input"
                  aria-label="공지 내용"
                  placeholder="예: 전년 대비 +8%"
                  value={goalNoticeForm.value}
                  onChange={(event) =>
                    setGoalNoticeForm((current) => ({ ...current, value: event.target.value }))
                  }
                />
              </label>
            </div>
            <label className="mt-3 grid gap-2">
              <span className="field-label">공지 메모</span>
              <textarea
                className="input min-h-24 py-3"
                aria-label="공지 메모"
                value={goalNoticeForm.note}
                onChange={(event) =>
                  setGoalNoticeForm((current) => ({ ...current, note: event.target.value }))
                }
              />
            </label>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                className="rounded-control border border-stone-300 bg-white px-4 py-2 font-bold text-cocoa"
                type="button"
                onClick={closeGoalNoticeForm}
              >
                취소
              </button>
              <Button type="button" onClick={() => void saveGoalNotice()}>
                공지 저장
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-3">
          {goalNotices.map((notice) => (
            <div key={notice.id} className="rounded-control border border-stone-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-blue/10 px-2 py-1 text-xs font-bold text-blue">
                  {goalNoticeCategoryLabels[notice.category]}
                </span>
                <div className="flex gap-1">
                  <button
                    className="inline-flex min-h-8 items-center justify-center rounded-control border border-stone-300 bg-white px-2 font-semibold hover:bg-stone-100"
                    type="button"
                    aria-label={`${notice.title} 수정`}
                    onClick={() => openGoalNoticeEdit(notice)}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    className="inline-flex min-h-8 items-center justify-center rounded-control border border-red/30 bg-white px-2 font-semibold text-red hover:bg-red/10"
                    type="button"
                    aria-label={`${notice.title} 삭제`}
                    onClick={() => void deleteGoalNotice(notice)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <p className="font-bold text-ink">{notice.title}</p>
              <p className="mt-2 text-xl font-bold tracking-[-0.03em] text-cocoa">{notice.value}</p>
              {notice.note ? (
                <p className="mt-2 text-sm leading-6 text-muted">{notice.note}</p>
              ) : null}
            </div>
          ))}
          {!isLoading && goalNotices.length === 0 ? (
            <div className="rounded-control border border-stone-200 px-3 py-6 text-center text-sm font-medium text-muted lg:col-span-3">
              등록된 홈 공지 없음
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">반응 분류</p>
            <h2 className="section-title">반응 기준 관리</h2>
          </div>
          <Button icon={Plus} type="button" onClick={() => openNewCriterionForm(null)}>
            대분류 추가
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-control border border-stone-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">1단계</p>
                <h3 className="text-base font-semibold">대분류</h3>
              </div>
              <span className="text-sm font-semibold text-muted">{majorCriteria.length}개</span>
            </div>
            <div className="mt-3 grid gap-2">
              {majorCriteria.map((criterion) => (
                <div
                  key={criterion.id}
                  className={criterionRowClass(selectedMajorId === criterion.id)}
                >
                  <button
                    className="min-w-0 text-left"
                    type="button"
                    onClick={() => selectMajorCriterion(criterion.id)}
                  >
                    <span className="block truncate font-semibold">{criterion.name}</span>
                    <span className="mt-1 block text-xs text-muted">
                      #{criterion.id} · 정렬 {criterion.sortOrder}
                    </span>
                  </button>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className={statusBadge(criterion.isActive)}>
                      {criterion.isActive ? "활성" : "비활성"}
                    </span>
                    <button
                      className="inline-flex min-h-8 items-center justify-center rounded-control border border-stone-300 bg-white px-2 font-semibold hover:bg-stone-100"
                      type="button"
                      onClick={() => openCriterionEdit(criterion)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      className="inline-flex min-h-8 items-center justify-center rounded-control border border-stone-300 bg-white px-2 font-semibold hover:bg-stone-100"
                      type="button"
                      onClick={() => void toggleCriterionStatus(criterion)}
                    >
                      {criterion.isActive ? "비활성" : "활성"}
                    </button>
                    <button
                      className="inline-flex min-h-8 items-center justify-center rounded-control border border-red/30 bg-white px-2 font-semibold text-red hover:bg-red/10"
                      type="button"
                      onClick={() => void deleteCriterion(criterion)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
              {!isLoading && majorCriteria.length === 0 ? (
                <div className="rounded-control border border-stone-200 px-3 py-6 text-center text-sm font-medium text-muted">
                  등록 대분류 없음
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-control border border-stone-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">2단계</p>
                <h3 className="text-base font-semibold">중분류</h3>
              </div>
              <Button
                className="min-h-9 px-3 text-sm"
                disabled={selectedMajorId === null}
                icon={Plus}
                type="button"
                onClick={() => openNewCriterionForm(selectedMajorId)}
              >
                추가
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted">
              {selectedMajor ? `선택 대분류: ${selectedMajor.name}` : "대분류를 선택하세요."}
            </p>
            <div className="mt-3 grid gap-2">
              {middleCriteria.map((criterion) => (
                <div
                  key={criterion.id}
                  className={criterionRowClass(selectedMiddleId === criterion.id)}
                >
                  <button
                    className="min-w-0 text-left"
                    type="button"
                    onClick={() => selectMiddleCriterion(criterion.id)}
                  >
                    <span className="block truncate font-semibold">{criterion.name}</span>
                    <span className="mt-1 block text-xs text-muted">
                      #{criterion.id} · 정렬 {criterion.sortOrder}
                    </span>
                  </button>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className={statusBadge(criterion.isActive)}>
                      {criterion.isActive ? "활성" : "비활성"}
                    </span>
                    <button
                      className="inline-flex min-h-8 items-center justify-center rounded-control border border-stone-300 bg-white px-2 font-semibold hover:bg-stone-100"
                      type="button"
                      onClick={() => openCriterionEdit(criterion)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      className="inline-flex min-h-8 items-center justify-center rounded-control border border-stone-300 bg-white px-2 font-semibold hover:bg-stone-100"
                      type="button"
                      onClick={() => void toggleCriterionStatus(criterion)}
                    >
                      {criterion.isActive ? "비활성" : "활성"}
                    </button>
                    <button
                      className="inline-flex min-h-8 items-center justify-center rounded-control border border-red/30 bg-white px-2 font-semibold text-red hover:bg-red/10"
                      type="button"
                      onClick={() => void deleteCriterion(criterion)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
              {!isLoading && selectedMajorId !== null && middleCriteria.length === 0 ? (
                <div className="rounded-control border border-stone-200 px-3 py-6 text-center text-sm font-medium text-muted">
                  등록 중분류 없음
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-control border border-stone-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">3단계</p>
                <h3 className="text-base font-semibold">소분류</h3>
              </div>
              <Button
                className="min-h-9 px-3 text-sm"
                disabled={selectedMiddleId === null}
                icon={Plus}
                type="button"
                onClick={() => openNewCriterionForm(selectedMiddleId)}
              >
                추가
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted">
              {selectedMiddle ? `선택 중분류: ${selectedMiddle.name}` : "중분류를 선택하세요."}
            </p>
            <div className="mt-3 grid gap-2">
              {minorCriteria.map((criterion) => (
                <div key={criterion.id} className={criterionRowClass(false)}>
                  <button
                    className="min-w-0 text-left"
                    type="button"
                    onClick={() => openCriterionEdit(criterion)}
                  >
                    <span className="block truncate font-semibold">{criterion.name}</span>
                    <span className="mt-1 block text-xs text-muted">
                      #{criterion.id} · 정렬 {criterion.sortOrder}
                    </span>
                  </button>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className={statusBadge(criterion.isActive)}>
                      {criterion.isActive ? "활성" : "비활성"}
                    </span>
                    <button
                      className="inline-flex min-h-8 items-center justify-center rounded-control border border-stone-300 bg-white px-2 font-semibold hover:bg-stone-100"
                      type="button"
                      onClick={() => openCriterionEdit(criterion)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      className="inline-flex min-h-8 items-center justify-center rounded-control border border-stone-300 bg-white px-2 font-semibold hover:bg-stone-100"
                      type="button"
                      onClick={() => void toggleCriterionStatus(criterion)}
                    >
                      {criterion.isActive ? "비활성" : "활성"}
                    </button>
                    <button
                      className="inline-flex min-h-8 items-center justify-center rounded-control border border-red/30 bg-white px-2 font-semibold text-red hover:bg-red/10"
                      type="button"
                      onClick={() => void deleteCriterion(criterion)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
              {!isLoading && selectedMiddleId !== null && minorCriteria.length === 0 ? (
                <div className="rounded-control border border-stone-200 px-3 py-6 text-center text-sm font-medium text-muted">
                  등록 소분류 없음
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {isCriterionFormOpen ? (
          <div className="mt-4 grid gap-3 border-t border-stone-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">
                {editingCriterionId === null
                  ? `${criterionLevelLabel(criterionFormDepth)} 추가`
                  : `${criterionLevelLabel(criterionFormDepth)} 수정 #${editingCriterionId}`}
              </h3>
              <button
                className="inline-flex min-h-9 items-center justify-center rounded-control border border-stone-300 bg-white px-3 font-semibold hover:bg-stone-100"
                type="button"
                onClick={closeCriterionForm}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_10rem_12rem]">
              <label className="grid gap-2">
                <span className="field-label">기준명</span>
                <input
                  className="input"
                  value={criterionForm.name}
                  onChange={(event) =>
                    setCriterionForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className="field-label">정렬 순서</span>
                <input
                  className="input"
                  inputMode="numeric"
                  value={criterionForm.sortOrder}
                  onChange={(event) =>
                    setCriterionForm((current) => ({ ...current, sortOrder: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className="field-label">상태</span>
                <select
                  className="input"
                  value={criterionForm.isActive ? "active" : "inactive"}
                  onChange={(event) =>
                    setCriterionForm((current) => ({
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
                icon={editingCriterionId === null ? Plus : Pencil}
                type="button"
                onClick={() => void saveCriterion()}
              >
                {editingCriterionId === null ? "추가" : "저장"}
              </Button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-stone-300 bg-white px-4 font-semibold hover:bg-stone-100"
                type="button"
                onClick={closeCriterionForm}
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
