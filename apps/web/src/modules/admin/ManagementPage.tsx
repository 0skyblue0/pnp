import { Pencil, Plus, RefreshCcw, Trash2, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";

import { apiDelete, apiGet, apiPatch, apiPost } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { productLineup } from "../../shared/productLineup.js";
import { Button } from "../../shared/ui/Button.js";
import { useConfirm } from "../../shared/ui/ConfirmDialog.js";

type ProductDto = {
  id: number;
  name: string;
  category: string | null;
  isSeasonal: boolean;
  seasonStart: string | null;
  seasonEnd: string | null;
  isActive: boolean;
  sortOrder: number;
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
  targetYear: number | null;
  monthlyTargets: MonthlyTargets | null;
  targetTotal: number | null;
};

type MonthKey = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12";
type MonthlyTargets = Record<MonthKey, number>;

type ScheduleTone = "launch" | "close" | "notice" | "holiday";

type AnnualScheduleDto = {
  id: string;
  date: string;
  title: string;
  note: string;
  tone?: ScheduleTone;
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
  targetYear: string;
  monthlyTargets: Record<MonthKey, string>;
};

type ScheduleForm = {
  date: string;
  title: string;
  note: string;
  tone: ScheduleTone | "";
};

type AdminTab = "product" | "staff" | "criteria" | "notice" | "schedule";

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

const monthKeys: MonthKey[] = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

function emptyMonthlyTargetInputs(): Record<MonthKey, string> {
  return Object.fromEntries(monthKeys.map((month) => [month, ""])) as Record<MonthKey, string>;
}

const emptyGoalNoticeForm: GoalNoticeForm = {
  category: "sales",
  title: "",
  value: "",
  note: "",
  targetYear: String(new Date().getFullYear()),
  monthlyTargets: emptyMonthlyTargetInputs()
};

const emptyScheduleForm: ScheduleForm = {
  date: "",
  title: "",
  note: "",
  tone: "notice"
};

const goalNoticeCategoryLabels: Record<AnnualGoalNoticeCategory, string> = {
  sales: "매출 목표",
  operation: "운영 목표",
  staff: "직원 공지"
};

const adminTabs: Array<{ key: AdminTab; label: string }> = [
  { key: "product", label: "제품 관리" },
  { key: "staff", label: "직원 관리" },
  { key: "criteria", label: "반응 기준 관리" },
  { key: "notice", label: "홈 공지 관리" },
  { key: "schedule", label: "연간 스케줄 관리" }
];

const productLineupOrder = new Map<string, number>(
  productLineup.map((name, index) => [name, index])
);

const scheduleToneLabels: Record<ScheduleTone, string> = {
  notice: "공지",
  launch: "출시",
  close: "마감",
  holiday: "휴무"
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

function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function digitsToCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("ko-KR") : "";
}

function numericInput(value: string): number {
  const parsed = Number(value.replace(/\D/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthlyTargetInputsFromNotice(notice: AnnualGoalNoticeDto): Record<MonthKey, string> {
  const targets = notice.monthlyTargets;
  return Object.fromEntries(
    monthKeys.map((month) => [month, targets ? targets[month].toLocaleString("ko-KR") : ""])
  ) as Record<MonthKey, string>;
}

function monthlyTargetsFromForm(form: GoalNoticeForm): MonthlyTargets {
  return Object.fromEntries(
    monthKeys.map((month) => [month, numericInput(form.monthlyTargets[month])])
  ) as MonthlyTargets;
}

function sortProducts(products: ProductDto[]): ProductDto[] {
  return [...products].sort((left, right) => {
    const leftOrder = left.sortOrder ?? productLineupOrder.get(left.name) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.sortOrder ?? productLineupOrder.get(right.name) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.name.localeCompare(right.name, "ko-KR");
  });
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

function monthKeyFromDate(date: string): string {
  return date.slice(0, 7);
}

function todayMonthKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function scheduleDateLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}.${Number(day)}`;
}

function scheduleMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${year}년 ${Number(month)}월`;
}

function scheduleMonthOptions(schedules: AnnualScheduleDto[], selectedMonth: string): string[] {
  return Array.from(
    new Set([selectedMonth, todayMonthKey(), ...schedules.map((schedule) => monthKeyFromDate(schedule.date))])
  )
    .filter(Boolean)
    .sort();
}

function calendarDates(monthKey: string): Array<{ date: string; day: number | null }> {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return [];
  }
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<{ date: string; day: number | null }> = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push({ date: `blank-${index}`, day: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: `${monthKey}-${String(day).padStart(2, "0")}`, day });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: `blank-end-${cells.length}`, day: null });
  }
  return cells;
}

export function ManagementPage() {
  const confirm = useConfirm();
  const productListRef = useRef<HTMLDivElement | null>(null);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [responseCriteria, setResponseCriteria] = useState<ResponseCriterionDto[]>([]);
  const [goalNotices, setGoalNotices] = useState<AnnualGoalNoticeDto[]>([]);
  const [annualSchedules, setAnnualSchedules] = useState<AnnualScheduleDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [editingCriterionId, setEditingCriterionId] = useState<number | null>(null);
  const [editingGoalNoticeId, setEditingGoalNoticeId] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [selectedScheduleMonth, setSelectedScheduleMonth] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [draggedProductId, setDraggedProductId] = useState<number | null>(null);
  const [selectedMajorId, setSelectedMajorId] = useState<number | null>(null);
  const [selectedMiddleId, setSelectedMiddleId] = useState<number | null>(null);
  const [criterionParentId, setCriterionParentId] = useState<number | null>(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [isStaffFormOpen, setIsStaffFormOpen] = useState(false);
  const [isCriterionFormOpen, setIsCriterionFormOpen] = useState(false);
  const [isGoalNoticeFormOpen, setIsGoalNoticeFormOpen] = useState(false);
  const [isScheduleFormOpen, setIsScheduleFormOpen] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>("product");
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [staffForm, setStaffForm] = useState<StaffForm>(emptyStaffForm);
  const [criterionForm, setCriterionForm] = useState<CriterionForm>(emptyCriterionForm);
  const [goalNoticeForm, setGoalNoticeForm] = useState<GoalNoticeForm>(emptyGoalNoticeForm);
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(emptyScheduleForm);

  const loadManagementData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const [productEnvelope, staffEnvelope, criterionEnvelope, goalNoticeEnvelope, scheduleEnvelope] =
      await Promise.all([
        apiGet<ListEnvelope<ProductDto>>("/product"),
        apiGet<ListEnvelope<StaffDto>>("/staff"),
        apiGet<ListEnvelope<ResponseCriterionDto>>("/response-criteria"),
        apiGet<ListEnvelope<AnnualGoalNoticeDto>>("/annual-goal-notice"),
        apiGet<{ items: AnnualScheduleDto[] }>("/annual-schedule")
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
    if (scheduleEnvelope.error) {
      setError(scheduleEnvelope.error.message);
      return;
    }

    setProducts(productEnvelope.data.items);
    setStaff(staffEnvelope.data.items);
    setResponseCriteria(criterionEnvelope.data.items);
    setGoalNotices(goalNoticeEnvelope.data.items);
    setAnnualSchedules(scheduleEnvelope.data.items);
  }, []);

  useEffect(() => {
    void loadManagementData();
  }, [loadManagementData]);

  useEffect(() => {
    const currentMonth = todayMonthKey();
    const selectedMonthHasSchedule = annualSchedules.some(
      (schedule) => monthKeyFromDate(schedule.date) === selectedScheduleMonth
    );
    if (selectedScheduleMonth && (selectedScheduleMonth !== currentMonth || selectedMonthHasSchedule)) {
      return;
    }
    const monthWithSchedule = annualSchedules.find(
      (schedule) => monthKeyFromDate(schedule.date) === currentMonth
    );
    setSelectedScheduleMonth(
      monthWithSchedule ? currentMonth : monthKeyFromDate(annualSchedules[0]?.date ?? currentMonth)
    );
  }, [annualSchedules, selectedScheduleMonth]);

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
      note: notice.note,
      targetYear: String(notice.targetYear ?? new Date().getFullYear()),
      monthlyTargets: monthlyTargetInputsFromNotice(notice)
    });
    setIsGoalNoticeFormOpen(true);
  }

  function closeGoalNoticeForm() {
    setEditingGoalNoticeId(null);
    setGoalNoticeForm(emptyGoalNoticeForm);
    setIsGoalNoticeFormOpen(false);
  }

  function openNewScheduleForm(date = "") {
    setEditingScheduleId(null);
    setScheduleForm({ ...emptyScheduleForm, date });
    setIsScheduleFormOpen(true);
  }

  function openScheduleEdit(schedule: AnnualScheduleDto) {
    setEditingScheduleId(schedule.id);
    setSelectedScheduleMonth(monthKeyFromDate(schedule.date));
    setScheduleForm({
      date: schedule.date,
      title: schedule.title,
      note: schedule.note,
      tone: schedule.tone ?? "notice"
    });
    setIsScheduleFormOpen(true);
  }

  function closeScheduleForm() {
    setEditingScheduleId(null);
    setScheduleForm(emptyScheduleForm);
    setIsScheduleFormOpen(false);
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

    const productName = productForm.name.trim();
    const category = productForm.category.trim();

    if (productName.length === 0) {
      setError("제품명을 입력하세요.");
      return;
    }

    const createBody = {
      name: productName,
      category: category || undefined,
      isSeasonal: productForm.isSeasonal,
      seasonStart: productForm.seasonStart || undefined,
      seasonEnd: productForm.seasonEnd || undefined,
      isActive: productForm.isActive
    };
    const updateBody = {
      name: productName,
      category: category || null,
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
    if (!(await confirm({ title: "제품 삭제", message: `${product.name} 제품을 삭제하시겠습니까?`, confirmLabel: "삭제", tone: "danger" }))) {
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

  async function saveProductOrder(nextOrder: ProductDto[]) {
    setProducts(nextOrder.map((product, index) => ({ ...product, sortOrder: (index + 1) * 10 })));
    setDraggedProductId(null);
    setMessage(null);
    setError(null);

    const envelope = await apiPatch<{ items: ProductDto[] }, { productIds: number[] }>("/product/reorder", {
      productIds: nextOrder.map((product) => product.id)
    });

    if (envelope.error) {
      setError(envelope.error.message);
      await loadManagementData();
      return;
    }

    setProducts(envelope.data.items);
    setMessage("제품 순서 저장 완료");
  }

  async function moveProductToIndex(productId: number, targetIndex: number) {
    const currentOrder = sortProducts(products);
    const fromIndex = currentOrder.findIndex((product) => product.id === productId);
    if (fromIndex < 0) {
      return;
    }

    const nextOrder = [...currentOrder];
    const [movedProduct] = nextOrder.splice(fromIndex, 1);
    if (!movedProduct) {
      return;
    }
    const boundedTargetIndex = Math.max(0, Math.min(targetIndex, nextOrder.length));
    nextOrder.splice(boundedTargetIndex, 0, movedProduct);

    await saveProductOrder(nextOrder);
  }

  async function moveProductBefore(targetProductId: number) {
    if (draggedProductId === null || draggedProductId === targetProductId) {
      setDraggedProductId(null);
      return;
    }

    const currentOrder = sortProducts(products);
    const toIndex = currentOrder.findIndex((product) => product.id === targetProductId);
    if (toIndex < 0) {
      setDraggedProductId(null);
      return;
    }

    await moveProductToIndex(draggedProductId, toIndex);
  }

  function scrollProductListDuringDrag(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const list = productListRef.current;
    if (!list) {
      return;
    }
    const bounds = list.getBoundingClientRect();
    const edgeSize = 72;
    if (event.clientY > bounds.bottom - edgeSize) {
      list.scrollBy({ top: 32, behavior: "auto" });
    } else if (event.clientY < bounds.top + edgeSize) {
      list.scrollBy({ top: -32, behavior: "auto" });
    }
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
    if (!(await confirm({ title: "직원 삭제", message: `${person.username} 직원을 삭제하시겠습니까?`, confirmLabel: "삭제", tone: "danger" }))) {
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
    const targetYear = Number(goalNoticeForm.targetYear);

    if (!title || (goalNoticeForm.category !== "sales" && !value)) {
      setError("공지 제목과 내용을 입력하세요.");
      return;
    }
    if (goalNoticeForm.category === "sales" && !Number.isInteger(targetYear)) {
      setError("목표 연도를 확인하세요.");
      return;
    }

    const monthlyTargets = monthlyTargetsFromForm(goalNoticeForm);
    const body =
      goalNoticeForm.category === "sales"
        ? {
            category: goalNoticeForm.category,
            title,
            value: `${targetYear}년 매출 목표`,
            note,
            targetYear,
            monthlyTargets
          }
        : { category: goalNoticeForm.category, title, value, note };
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



  async function saveSchedule() {
    setMessage(null);
    setError(null);

    const date = scheduleForm.date;
    const title = scheduleForm.title.trim();
    const note = scheduleForm.note.trim();
    const tone = scheduleForm.tone || "notice";

    if (!date || !title) {
      setError("스케줄 날짜와 제목을 입력하세요.");
      return;
    }

    const body = { date, title, note, tone };
    const envelope =
      editingScheduleId === null
        ? await apiPost<AnnualScheduleDto, Record<string, unknown>>("/annual-schedule", body)
        : await apiPatch<AnnualScheduleDto, Record<string, unknown>>(
            `/annual-schedule/${editingScheduleId}`,
            body
          );

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setSelectedScheduleMonth(monthKeyFromDate(envelope.data.date));
    setMessage(editingScheduleId === null ? `스케줄 추가: ${envelope.data.title}` : "스케줄 수정 완료");
    closeScheduleForm();
    await loadManagementData();
  }

  async function deleteSchedule(schedule: AnnualScheduleDto) {
    if (!(await confirm({ title: "스케줄 삭제", message: `${schedule.title} 스케줄을 삭제하시겠습니까?`, confirmLabel: "삭제", tone: "danger" }))) {
      return;
    }

    setMessage(null);
    setError(null);
    const envelope = await apiDelete<{ deleted: boolean }>(`/annual-schedule/${schedule.id}`);

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage("스케줄 삭제 완료");
    if (editingScheduleId === schedule.id) {
      closeScheduleForm();
    }
    await loadManagementData();
  }


  async function deleteGoalNotice(notice: AnnualGoalNoticeDto) {
    if (!(await confirm({ title: "홈 공지 삭제", message: `${notice.title} 홈 공지를 삭제하시겠습니까?`, confirmLabel: "삭제", tone: "danger" }))) {
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
    if (
      !nextActive &&
      !(await confirm({
        title: "반응 기준 비활성화",
        message: `${criterion.name} 반응 기준을 비활성 처리하시겠습니까?`,
        confirmLabel: "비활성화",
        tone: "danger"
      }))
    ) {
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
    if (!(await confirm({ title: "반응 기준 삭제", message: `${criterion.name} 반응 기준을 삭제하시겠습니까?`, confirmLabel: "삭제", tone: "danger" }))) {
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
  const sortedProducts = sortProducts(products);
  const normalizedProductSearch = productSearchQuery.trim().toLocaleLowerCase("ko-KR");
  const visibleProducts = sortedProducts.filter((product) => {
    if (!normalizedProductSearch) {
      return true;
    }
    return [product.name, product.category ?? ""]
      .join(" ")
      .toLocaleLowerCase("ko-KR")
      .includes(normalizedProductSearch);
  });
  const editingCriterion = responseCriteria.find(
    (criterion) => criterion.id === editingCriterionId
  );
  const criterionFormParent =
    criterionParentId === null
      ? null
      : responseCriteria.find((criterion) => criterion.id === criterionParentId);
  const criterionFormDepth =
    editingCriterion?.depth ?? (criterionFormParent ? criterionFormParent.depth + 1 : 1);
  const scheduleMonth = selectedScheduleMonth || todayMonthKey();
  const scheduleOptions = scheduleMonthOptions(annualSchedules, scheduleMonth);
  const monthlySchedules = annualSchedules.filter(
    (schedule) => monthKeyFromDate(schedule.date) === scheduleMonth
  );
  const schedulesByDate = monthlySchedules.reduce<Record<string, AnnualScheduleDto[]>>(
    (grouped, schedule) => {
      grouped[schedule.date] = [...(grouped[schedule.date] ?? []), schedule];
      return grouped;
    },
    {}
  );
  const scheduleCells = calendarDates(scheduleMonth);

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section className="order-1 min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="section-title">관리</h2>
            <h2 className="sr-only">홈 목표·매출 공지 관리</h2>
          </div>
          <Button className="sr-only" icon={RefreshCcw} type="button" onClick={() => void loadManagementData()}>
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

        <div className="mb-4 rounded-control border border-bread/30 bg-cream/60 px-3 py-3 text-sm leading-6 text-cocoa">
          관리 탭은 매일 입력하는 곳이 아니라 제품, 직원, 손님 반응 분류, 홈 공지를 깨끗하게 유지하는 기준 정보입니다.
          테스트처럼 보이는 이름이나 쓰지 않는 항목은 비활성 처리하면 예약·손님 반응 입력에서 실수가 줄어듭니다.
          <div className="mt-3 grid gap-2 text-xs font-semibold text-muted sm:grid-cols-3">
            <div className="rounded-control border border-latte bg-white px-3 py-2">데이터 청소: 안 쓰는 제품·직원·테스트 항목 정리</div>
            <div className="rounded-control border border-latte bg-white px-3 py-2">홈 표시 관리: 매출 목표·운영 목표·직원 공지 최신화</div>
            <div className="rounded-control border border-latte bg-white px-3 py-2">분류 기준 관리: 손님 반응 AI 기준을 현장 언어로 유지</div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="dc-card px-3 py-3">
            <p className="text-[10px] text-muted">전체 제품</p>
            <p className="mt-1 text-[15px] font-bold text-ink">{products.length}</p>
          </div>
          <div className="dc-card px-3 py-3">
            <p className="text-[10px] text-muted">활성 제품</p>
            <p className="mt-1 text-[15px] font-bold text-ink">
              {products.filter((product) => product.isActive).length}
            </p>
          </div>
          <div className="dc-card px-3 py-3">
            <p className="text-[10px] text-muted">전체 직원</p>
            <p className="mt-1 text-[15px] font-bold text-ink">{staff.length}</p>
          </div>
          <div className="dc-card px-3 py-3">
            <p className="text-[10px] text-muted">활성 직원</p>
            <p className="mt-1 text-[15px] font-bold text-ink">
              {staff.filter((person) => person.isActive).length}
            </p>
          </div>
          <div className="sr-only rounded-control border border-stone-200 px-3 py-3">
            <p className="text-sm text-muted">반응 기준</p>
            <p className="mt-1 text-2xl font-semibold">{responseCriteria.length}</p>
          </div>
          <div className="sr-only rounded-control border border-stone-200 px-3 py-3">
            <p className="text-sm text-muted">활성 기준</p>
            <p className="mt-1 text-2xl font-semibold">
              {responseCriteria.filter((criterion) => criterion.isActive).length}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-[6px]">
          {adminTabs.map((tab) => {
            const isActive = activeAdminTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className={[
                  "rounded-[9px] px-4 py-2 text-[12.5px] font-semibold transition",
                  isActive ? "bg-bread text-white" : "bg-cream text-cocoa hover:bg-[#EFE6DA]"
                ].join(" ")}
                onClick={() => setActiveAdminTab(tab.key)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-[14px]">
          {activeAdminTab === "product" ? (
            <div className="rounded-[14px] border border-latte bg-white px-5 py-[18px]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-bold text-ink">제품명 등록 및 수정</h3>
                  <p className="mt-1 text-[12.5px] text-muted">
                    일일 운영과 예약 입력에 보이는 제품명을 추가·수정·삭제합니다. 비활성 제품도 관리 목록에는 남겨두어 다시 활성화할 수 있습니다.
                  </p>
                </div>
                <button
                  className="rounded-[9px] bg-bread px-4 py-2 text-[12.5px] font-bold text-white"
                  type="button"
                  onClick={openNewProductForm}
                >
                  제품 추가
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-latte bg-cream/50 px-4 py-3">
                <label className="grid min-w-[16rem] flex-1 gap-1">
                  <span className="field-label">제품명 검색</span>
                  <input
                    className="input bg-white"
                    aria-label="제품명 검색"
                    placeholder="예: 깜빠뉴, 바게트, 샌드위치"
                    value={productSearchQuery}
                    onChange={(event) => setProductSearchQuery(event.target.value)}
                  />
                </label>
                <div className="text-right text-xs font-bold text-muted">
                  <p>표시 {visibleProducts.length.toLocaleString("ko-KR")}개 / 전체 {products.length.toLocaleString("ko-KR")}개</p>
                  <p className="mt-1 text-[11px] font-semibold">손잡이를 드래그하면 목록이 자동으로 스크롤됩니다. 멀리 옮길 때는 맨위·맨아래 버튼을 쓰세요.</p>
                  {productSearchQuery ? (
                    <button className="mt-1 text-cocoa underline" type="button" onClick={() => setProductSearchQuery("")}>검색 초기화</button>
                  ) : null}
                </div>
              </div>

              {isProductFormOpen ? (
                <div className="mt-4 rounded-[12px] border border-latte bg-cream/50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-bold text-ink">
                      {editingProductId === null ? "제품 추가" : "제품 수정"}
                    </h4>
                    <button
                      className="inline-flex min-h-9 items-center justify-center rounded-control border border-latte bg-white px-3 font-bold text-cocoa hover:bg-cream"
                      type="button"
                      aria-label="제품 입력 닫기"
                      onClick={closeProductForm}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_9rem]">
                    <label className="grid gap-2">
                      <span className="field-label">제품명</span>
                      <input
                        className="input"
                        aria-label="제품명"
                        placeholder="예: 바게트"
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
                        aria-label="카테고리"
                        placeholder="예: 상시 / 시즌 / 샌드위치"
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
                        aria-label="상태"
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
                  <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                    <label className="grid gap-2">
                      <span className="field-label">시즌 시작</span>
                      <input
                        className="input"
                        aria-label="시즌 시작"
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
                        aria-label="시즌 종료"
                        type="date"
                        value={productForm.seasonEnd}
                        onChange={(event) =>
                          setProductForm((current) => ({ ...current, seasonEnd: event.target.value }))
                        }
                      />
                    </label>
                    <label className="mt-7 inline-flex min-h-11 items-center gap-3 rounded-control border border-latte bg-white px-3 font-bold text-cocoa">
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
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      className="rounded-control border border-stone-300 bg-white px-4 py-2 font-bold text-cocoa"
                      type="button"
                      onClick={closeProductForm}
                    >
                      취소
                    </button>
                    <button
                      className="rounded-control bg-bread px-4 py-2 font-bold text-white"
                      type="button"
                      onClick={() => void saveProduct()}
                    >
                      제품 저장
                    </button>
                  </div>
                </div>
              ) : null}

              <div ref={productListRef} className="mt-4 max-h-[460px] overflow-y-auto rounded-[12px] border border-latte bg-white px-4 py-2" onDragOver={scrollProductListDuringDrag}>
                <div className="sticky top-0 z-10 grid grid-cols-[5.6rem_minmax(7rem,1.4fr)_minmax(5rem,0.8fr)_minmax(4rem,0.6fr)_minmax(8rem,1fr)_8rem] gap-2 border-b border-[#EFE8DC] bg-white py-2 text-[11px] font-semibold text-muted">
                  <div>순서</div><div>제품명</div><div>카테고리</div><div>시즌</div><div>기간</div><div>수정·삭제</div>
                </div>
                {visibleProducts.map((product) => (
                  <div
                    key={product.id}
                    aria-label={`${product.name} 제품 행`}
                    draggable
                    onDragStart={() => setDraggedProductId(product.id)}
                    onDragOver={scrollProductListDuringDrag}
                    onDrop={() => void moveProductBefore(product.id)}
                    onDragEnd={() => setDraggedProductId(null)}
                    className={[
                      "grid grid-cols-[5.6rem_minmax(7rem,1.4fr)_minmax(5rem,0.8fr)_minmax(4rem,0.6fr)_minmax(8rem,1fr)_8rem] items-center gap-2 border-b border-[#F5F0E7] py-3 text-[13px] last:border-b-0",
                      product.isActive ? "text-ink" : "bg-stone-50 text-muted"
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap gap-1">
                      <button
                        className="cursor-grab rounded-[8px] border border-latte bg-cream px-2 py-1 text-xs font-extrabold text-cocoa active:cursor-grabbing"
                        type="button"
                        aria-label={`${product.name} 순서 드래그`}
                        title="드래그해서 순서 변경"
                      >
                        ↕
                      </button>
                      <button
                        className="rounded-[8px] border border-latte bg-white px-1.5 py-1 text-[11px] font-bold text-cocoa"
                        type="button"
                        aria-label={`${product.name} 맨 위로 이동`}
                        onClick={() => void moveProductToIndex(product.id, 0)}
                      >
                        맨위
                      </button>
                      <button
                        className="rounded-[8px] border border-latte bg-white px-1.5 py-1 text-[11px] font-bold text-cocoa"
                        type="button"
                        aria-label={`${product.name} 맨 아래로 이동`}
                        onClick={() => void moveProductToIndex(product.id, products.length - 1)}
                      >
                        맨아래
                      </button>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{product.name}</p>
                      <span className={statusBadge(product.isActive)}>
                        {product.isActive ? "활성" : "비활성"}
                      </span>
                    </div>
                    <div className="text-muted">{product.category ?? "-"}</div>
                    <div>{product.isSeasonal ? "시즌" : "상시"}</div>
                    <div className="text-[12px] text-muted">
                      {product.seasonStart || product.seasonEnd
                        ? `${product.seasonStart ?? "-"} ~ ${product.seasonEnd ?? "-"}`
                        : "-"}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        className="rounded-[8px] border border-latte px-2 py-1 text-xs font-bold text-cocoa"
                        type="button"
                        aria-label={`${product.name} 수정`}
                        onClick={() => openProductEdit(product)}
                      >
                        수정
                      </button>
                      <button
                        className="rounded-[8px] border border-red/30 bg-white px-2 py-1 text-xs font-bold text-red"
                        type="button"
                        aria-label={`${product.name} 삭제`}
                        onClick={() => void deleteProduct(product)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
                {!isLoading && visibleProducts.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted">등록 제품 없음</div>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeAdminTab === "staff" ? (
            <div className="rounded-[14px] border border-latte bg-white px-[22px] pb-[6px] pt-2">
              <div className="grid grid-cols-[1fr_1.4fr_1fr_0.8fr] gap-2 border-b border-[#EFE8DC] px-1 py-[11px] text-[11px] font-semibold text-muted">
                <div>아이디</div><div>표시 이름</div><div>역할</div><div>상태</div>
              </div>
              {staff.map((person) => (
                <div
                  key={person.id}
                  className="grid grid-cols-[1fr_1.4fr_1fr_0.8fr] items-center gap-2 border-b border-[#F5F0E7] px-1 py-[11px] text-[13px] text-ink last:border-b-0"
                >
                  <div className="text-muted">{person.username}</div>
                  <div className="font-semibold">{person.displayName ?? person.username}</div>
                  <div>{roleLabel(person.role)}</div>
                  <div>
                    <span className={[
                      "rounded-full px-[10px] py-[3px] text-[11px] font-bold",
                      person.isActive ? "bg-green/10 text-green" : "bg-stone-100 text-muted"
                    ].join(" ")}>
                      {person.isActive ? "활성" : "비활성"}
                    </span>
                  </div>
                </div>
              ))}
              {!isLoading && staff.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm font-medium text-muted">등록 직원 없음</div>
              ) : null}
            </div>
          ) : null}

          {activeAdminTab === "criteria" ? (
            <div className="rounded-[14px] border border-latte bg-white px-5 py-[18px] text-[12.5px] text-muted">
              대분류(제품·서비스·응대·구매·운영·손님경험·기타) 아래 중분류·소분류를 트리 형태로 추가/수정/정렬/비활성화하는 화면입니다.
            </div>
          ) : null}

          {activeAdminTab === "notice" ? (
            <div className="rounded-[14px] border border-latte bg-white px-5 py-[18px]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-bold text-ink">직원 공지 등록 및 수정</h3>
                  <p className="mt-1 text-[12.5px] text-muted">홈 화면에 노출되는 매출 목표 공지, 직원 공지를 추가·수정·삭제하는 화면입니다.</p>
                </div>
                <button className="rounded-[9px] bg-bread px-4 py-2 text-[12.5px] font-bold text-white" type="button" onClick={openNewGoalNoticeForm}>
                  홈 공지 추가
                </button>
              </div>

              {isGoalNoticeFormOpen ? (
                <div className="mt-4 rounded-[12px] border border-latte bg-cream/50 p-4">
                  <div className="grid gap-3 lg:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]">
                    <label className="grid gap-2">
                      <span className="field-label">공지 종류</span>
                      <select className="input" aria-label="공지 종류" value={goalNoticeForm.category} onChange={(event) => setGoalNoticeForm((current) => ({ ...current, category: event.target.value as AnnualGoalNoticeCategory }))}>
                        <option value="sales">매출 목표</option>
                        <option value="operation">운영 목표</option>
                        <option value="staff">직원 공지</option>
                      </select>
                    </label>
                    <label className="grid gap-2">
                      <span className="field-label">공지 제목</span>
                      <input className="input" aria-label="공지 제목" value={goalNoticeForm.title} onChange={(event) => setGoalNoticeForm((current) => ({ ...current, title: event.target.value }))} />
                    </label>
                    {goalNoticeForm.category === "sales" ? (
                      <label className="grid gap-2">
                        <span className="field-label">목표 연도</span>
                        <input className="input" aria-label="목표 연도" inputMode="numeric" value={goalNoticeForm.targetYear} onChange={(event) => setGoalNoticeForm((current) => ({ ...current, targetYear: event.target.value.replace(/\D/g, "").slice(0, 4) }))} />
                      </label>
                    ) : (
                      <label className="grid gap-2">
                        <span className="field-label">공지 내용</span>
                        <input className="input" aria-label="공지 내용" value={goalNoticeForm.value} onChange={(event) => setGoalNoticeForm((current) => ({ ...current, value: event.target.value }))} />
                      </label>
                    )}
                  </div>
                  {goalNoticeForm.category === "sales" ? (
                    <div className="mt-3 rounded-[12px] border border-latte bg-white p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-cocoa">월별 매출 목표</p>
                        <p className="text-sm font-extrabold text-bread">최종 총합 {formatCurrency(Object.values(monthlyTargetsFromForm(goalNoticeForm)).reduce((total, amount) => total + amount, 0))}</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {monthKeys.map((month) => (
                          <label key={month} className="grid gap-1">
                            <span className="text-xs font-bold text-muted">{Number(month)}월</span>
                            <span className="relative block">
                              <input
                                className="input w-full pr-8 text-right"
                                aria-label={`${Number(month)}월 매출 목표`}
                                inputMode="numeric"
                                placeholder="0"
                                value={goalNoticeForm.monthlyTargets[month]}
                                onChange={(event) => setGoalNoticeForm((current) => ({
                                  ...current,
                                  monthlyTargets: {
                                    ...current.monthlyTargets,
                                    [month]: digitsToCurrencyInput(event.target.value)
                                  }
                                }))}
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">원</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <label className="mt-3 grid gap-2">
                    <span className="field-label">공지 메모</span>
                    <textarea className="input min-h-20 py-3" aria-label="공지 메모" value={goalNoticeForm.note} onChange={(event) => setGoalNoticeForm((current) => ({ ...current, note: event.target.value }))} />
                  </label>
                  <div className="mt-3 flex justify-end gap-2">
                    <button className="rounded-control border border-stone-300 bg-white px-4 py-2 font-bold text-cocoa" type="button" onClick={closeGoalNoticeForm}>취소</button>
                    <button className="rounded-control bg-bread px-4 py-2 font-bold text-white" type="button" onClick={() => void saveGoalNotice()}>공지 저장</button>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {goalNotices.map((notice) => (
                  <div key={notice.id} className="rounded-[12px] border border-[#EFE8DC] bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-blue/10 px-2 py-1 text-xs font-bold text-blue">{goalNoticeCategoryLabels[notice.category]}</span>
                      <div className="flex gap-1">
                        <button className="rounded-[8px] border border-latte px-2 py-1 text-xs font-bold text-cocoa" type="button" aria-label={`${notice.title} 수정`} onClick={() => openGoalNoticeEdit(notice)}>수정</button>
                        <button className="rounded-[8px] border border-red/30 px-2 py-1 text-xs font-bold text-red" type="button" aria-label={`${notice.title} 삭제`} onClick={() => void deleteGoalNotice(notice)}>삭제</button>
                      </div>
                    </div>
                    <p className="font-bold text-ink">{notice.title}</p>
                    {notice.category === "sales" ? (
                      <div className="mt-2 grid gap-1 text-sm text-cocoa">
                        <p className="font-bold">{notice.targetYear ?? "연도 미지정"}년 매출 목표</p>
                        <p>총합 {formatCurrency(notice.targetTotal ?? 0)}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-[15px] font-bold text-cocoa">{notice.value}</p>
                    )}
                    {notice.note ? <p className="mt-2 text-sm leading-6 text-muted">{notice.note}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeAdminTab === "schedule" ? (
            <div className="rounded-[14px] border border-latte bg-white px-5 py-[18px]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-bold text-ink">연간 스케줄 달력 관리</h3>
                  <p className="mt-1 text-[12.5px] text-muted">다이어리처럼 날짜 칸을 눌러 행사, 출시, 마감 일정을 바로 기입하고 관리합니다.</p>
                </div>
                <button className="rounded-[9px] bg-bread px-4 py-2 text-[12.5px] font-bold text-white" type="button" onClick={() => openNewScheduleForm(`${scheduleMonth}-01`)}>
                  스케줄 추가
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-latte bg-cream/50 px-4 py-3">
                <div>
                  <p className="text-[11px] font-bold text-muted">선택한 달</p>
                  <p className="mt-1 text-lg font-extrabold text-ink">{scheduleMonthLabel(scheduleMonth)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="grid gap-1 text-xs font-bold text-muted">
                    월 선택
                    <select
                      className="input min-h-10 min-w-[9rem] bg-white text-sm"
                      aria-label="스케줄 월 선택"
                      value={scheduleMonth}
                      onChange={(event) => setSelectedScheduleMonth(event.target.value)}
                    >
                      {scheduleOptions.map((month) => (
                        <option key={month} value={month}>{scheduleMonthLabel(month)}</option>
                      ))}
                    </select>
                  </label>
                  <input
                    className="input min-h-10 w-[9rem] bg-white text-sm"
                    aria-label="스케줄 월 직접 입력"
                    type="month"
                    value={scheduleMonth}
                    onChange={(event) => setSelectedScheduleMonth(event.target.value)}
                  />
                </div>
              </div>

              {isScheduleFormOpen ? (
                <div className="mt-4 rounded-[12px] border border-latte bg-cream/50 p-4">
                  <div className="grid gap-3 lg:grid-cols-[11rem_8rem_minmax(0,1fr)_minmax(0,1fr)]">
                    <label className="grid gap-2">
                      <span className="field-label">날짜</span>
                      <input className="input" aria-label="스케줄 날짜" type="date" value={scheduleForm.date} onChange={(event) => setScheduleForm((current) => ({ ...current, date: event.target.value }))} />
                    </label>
                    <label className="grid gap-2">
                      <span className="field-label">구분</span>
                      <select className="input" aria-label="스케줄 구분" value={scheduleForm.tone} onChange={(event) => setScheduleForm((current) => ({ ...current, tone: event.target.value as ScheduleForm["tone"] }))}>
                        <option value="notice">공지</option>
                        <option value="launch">출시</option>
                        <option value="close">마감</option>
                        <option value="holiday">휴무</option>
                      </select>
                    </label>
                    <label className="grid gap-2">
                      <span className="field-label">제목</span>
                      <input className="input" aria-label="스케줄 제목" value={scheduleForm.title} onChange={(event) => setScheduleForm((current) => ({ ...current, title: event.target.value }))} />
                    </label>
                    <label className="grid gap-2">
                      <span className="field-label">메모</span>
                      <input className="input" aria-label="스케줄 메모" value={scheduleForm.note} onChange={(event) => setScheduleForm((current) => ({ ...current, note: event.target.value }))} />
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button className="rounded-control border border-stone-300 bg-white px-4 py-2 font-bold text-cocoa" type="button" onClick={closeScheduleForm}>취소</button>
                    <button className="rounded-control bg-bread px-4 py-2 font-bold text-white" type="button" onClick={() => void saveSchedule()}>스케줄 저장</button>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 overflow-hidden rounded-[12px] border border-latte bg-white">
                <div className="grid grid-cols-7 border-b border-[#EFE8DC] bg-cream/60 text-center text-[11px] font-extrabold text-cocoa">
                  {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                    <div key={day} className="border-r border-[#EFE8DC] py-2 last:border-r-0">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {scheduleCells.map((cell) => {
                    const daySchedules = cell.day === null ? [] : schedulesByDate[cell.date] ?? [];
                    return (
                      <div
                        key={cell.date}
                        className={[
                          "min-h-[8.5rem] border-r border-b border-[#F5F0E7] p-2 last:border-r-0",
                          cell.day === null ? "bg-stone-50/60" : "bg-white"
                        ].join(" ")}
                      >
                        {cell.day !== null ? (
                          <>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-sm font-extrabold text-ink">{cell.day}</span>
                              <button
                                className="rounded-full border border-latte bg-cream px-2 py-0.5 text-[10px] font-bold text-cocoa hover:bg-[#EFE6DA]"
                                type="button"
                                aria-label={`${scheduleDateLabel(cell.date)} 스케줄 추가`}
                                onClick={() => openNewScheduleForm(cell.date)}
                              >
                                추가
                              </button>
                            </div>
                            <div className="grid gap-1.5">
                              {daySchedules.map((schedule) => (
                                <div key={schedule.id} className="rounded-[8px] border border-latte bg-cream/60 px-2 py-1.5">
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="min-w-0">
                                      <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-cocoa">{scheduleToneLabels[schedule.tone ?? "notice"]}</span>
                                      <p className="mt-1 break-words text-[12px] font-extrabold leading-4 text-ink">{schedule.title}</p>
                                    </div>
                                    <div className="flex shrink-0 gap-1">
                                      <button className="text-[10px] font-bold text-cocoa underline" type="button" aria-label={`${schedule.title} 수정`} onClick={() => openScheduleEdit(schedule)}>수정</button>
                                      <button className="text-[10px] font-bold text-red underline" type="button" aria-label={`${schedule.title} 삭제`} onClick={() => void deleteSchedule(schedule)}>삭제</button>
                                    </div>
                                  </div>
                                  {schedule.note ? <p className="mt-1 break-words text-[11px] leading-4 text-muted">{schedule.note}</p> : null}
                                </div>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {!isLoading && monthlySchedules.length === 0 ? <div className="px-4 py-8 text-center text-sm text-muted">선택한 달에 등록된 스케줄 없음</div> : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="sr-only order-5">
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

      <section className="hidden order-2" aria-hidden="true">
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

      <section className="sr-only order-3">
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
