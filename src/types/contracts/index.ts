// חוזי G1 משותפים לשתי התצוגות.
export type Uuid = string
export type IsoDate = string // YYYY-MM-DD
export type IsoDateTime = string
export type Agorot = number // safe integer
export type Month = { year: number; month: number }

export type ErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT'
  | 'PROJECT_READ_ONLY' | 'LIMIT' | 'RATE_LIMITED' | 'UNAVAILABLE'

export type AppError = { code: ErrorCode; message: string; fieldErrors?: Record<string, string> }
export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError }
export type Page<T> = { items: T[]; nextCursor: string | null }

export type Actor = { userId: Uuid; fullName: string; email: string; isOwner: boolean }
export type Db = import('@supabase/supabase-js').SupabaseClient<import('../database').Database>
export type RequestContext = {
  readonly actor: Actor
  readonly db: Db // user JWT, never secret key
  readonly today: IsoDate // Asia/Jerusalem, from server
}

export type Operation<I, O> = (ctx: RequestContext, input: I) => Promise<Result<O>>
export type ActionsOf<T> = {
  [K in keyof T]: T[K] extends Operation<infer I, infer O> ? (input: I) => Promise<Result<O>> : never
}

export type ProjectRole = 'manager' | 'worker'
export type Saved = { id: Uuid; revision: number }
export type Edit = { id: Uuid; expectedRevision: number }

export type ProjectPermissions = {
  view: boolean
  editDetails: boolean
  uploadDocument: boolean
  manageAccess: boolean
  writeTasks: boolean
  deleteTasks: boolean
  report: boolean
  viewFinance: boolean
  writeFinance: boolean
  cancelTransaction: boolean
}

export type FilePurpose = 'document' | 'diary' | 'cover'
export type FileRef = {
  id: Uuid; name: string; mime: string; sizeBytes: number
  displayState: 'none' | 'ready' | 'failed'
}
export type UploadRequest = {
  purpose: FilePurpose; projectId: Uuid
  files: { clientId: Uuid; name: string; mime: string; sizeBytes: number }[]
}
export type UploadTarget = {
  clientId: Uuid
  target: Result<{
    fileId: Uuid; endpoint: string; publishableKey: string; token: string
    bucket: string; path: string
  }>
}

export interface AuthService {
  signIn(input: { email: string; password: string }): Promise<Result<Actor>>
  signOut(): Promise<Result<null>>
  getContext(): Promise<Result<RequestContext>>
}

/** Server-only RPC contracts; passwords are never sent to database functions. */
export type CreateProfileInput = { requestId: Uuid; email: string; fullName: string }
export type ProfileCreationResult = Saved & { passwordPending: boolean }
export type PrepareProfileUpdateInput = Edit & { fullName: string; email: string }
export type ProfileUpdateResult = Saved & { emailPending: boolean }
export type CompleteProfileCreationInput = { requestId: Uuid; userId: Uuid }
export type UploadCompletion = {
  fileId: Uuid; projectId: Uuid; uploadedBy: Uuid; purpose: FilePurpose
  bucket: string; path: string; name: string; declaredMime: string; declaredSize: number
} & ({ state: 'pending' | 'rejected'; fileRef: null } | { state: 'ready'; fileRef: FileRef })

export interface AuthAdmin {
  createUser: Operation<{ requestId: Uuid; email: string; fullName: string; password: string }, { userId: Uuid }>
  setPassword: Operation<{ userId: Uuid; password: string }, null>
  setEmail: Operation<{ userId: Uuid; expectedRevision: number; fullName: string; email: string }, Saved>
}

export interface StorageService {
  beginUpload: Operation<UploadRequest, UploadTarget[]>
  finishUpload: Operation<{ fileId: Uuid }, FileRef>
  getSignedUrl: Operation<
    { fileId: Uuid; variant: 'original' | 'display'; download: boolean },
    { url: string; expiresInSeconds: 60 }
  >
  readBytes: Operation<{ fileId: Uuid; variant: 'original' | 'display' }, Uint8Array>
}

export interface PermissionService {
  forProject: Operation<{ projectId: Uuid }, ProjectPermissions>
  requireOwner: Operation<Record<string, never>, null>
}

export type SensitiveEvent = {
  id: number; occurredAt: IsoDateTime; actorName: string; action: string
  entityType: string; entityId: string; projectId: Uuid | null
  before: unknown; after: unknown
}
export interface AuditService {
  list: Operation<{ projectId?: Uuid; cursor?: string }, Page<SensitiveEvent>>
}

export interface Format {
  date(value: IsoDate): string
  dateTime(value: IsoDateTime): string
  money(value: Agorot): string
  searchKey(value: string): string // spaces, quotes, case
  todayInIsrael(now?: Date): IsoDate
}

export interface Platform {
  auth: AuthService
  authAdmin: AuthAdmin
  storage: StorageService
  permissions: PermissionService
  audit: AuditService
  format: Format
  fetchAll<T>(page: (from: number, to: number) => Promise<T[]>): Promise<T[]>
  rpc<I, O>(ctx: RequestContext, name: string, input: I): Promise<Result<O>>
}

export type UserAssignment = {
  projectId: Uuid; projectName: string; role: ProjectRole; financeAccess: boolean; revision: number
}
export type UserRow = {
  id: Uuid; fullName: string; email: string; isOwner: boolean; isActive: boolean
  revision: number; assignments: UserAssignment[]
}
export type MemberRow = {
  userId: Uuid; fullName: string; role: ProjectRole
  financeAccess: boolean; isActive: boolean; revision: number
}

export interface UsersApi {
  listUsers: Operation<{ search?: string }, UserRow[]>
  getUser: Operation<{ id: Uuid }, UserRow>
  listProjectMembers: Operation<{ projectId: Uuid }, MemberRow[]>
  createUser: Operation<{ requestId: Uuid; email: string; fullName: string; password: string }, Saved>
  updateUser: Operation<Edit & { fullName: string; email: string }, Saved>
  setUserActive: Operation<Edit & { active: boolean }, Saved>
  resetPassword: Operation<{ id: Uuid; password: string }, null>
  setMembership: Operation<
    { userId: Uuid; projectId: Uuid; role: ProjectRole; expectedRevision: number | null },
    { revision: number; financeAccess: boolean }
  >
  removeMembership: Operation<{ userId: Uuid; projectId: Uuid; expectedRevision: number }, null>
  setFinanceAccess: Operation<
    { userId: Uuid; projectId: Uuid; enabled: boolean; expectedRevision: number },
    { revision: number }
  >
}

export type ProjectStatus = 'active' | 'completed'
export type ProjectFields = {
  name: string; businessName: string; siteAddress: string
  contact: { name: string; phone: string; email: string | null; roleTitle: string | null }
  startDate: IsoDate | null; endDate: IsoDate | null; accessNotes: string | null
  businessNumber?: string | null // owner only
}
export type ProjectCard = {
  id: Uuid; name: string; businessName: string; siteAddress: string
  status: ProjectStatus; archived: boolean; coverFileId: Uuid | null
  reportCount: number; openTaskCount: number
}
export type ProjectDetails = ProjectFields & {
  id: Uuid; status: ProjectStatus; archived: boolean; revision: number
  coverFileId: Uuid | null; managerNames: string[]; permissions: ProjectPermissions
}

export interface ProjectsApi {
  listProjects: Operation<
    { search?: string; status?: ProjectStatus; archived?: boolean },
    ProjectCard[]
  >
  getProject: Operation<{ id: Uuid }, ProjectDetails>
  createProject: Operation<{ requestId: Uuid; fields: ProjectFields }, Saved>
  updateProject: Operation<Edit & { fields: ProjectFields }, Saved>
  setProjectStatus: Operation<Edit & { status: ProjectStatus }, Saved>
  setProjectArchived: Operation<Edit & { archived: boolean }, Saved>
  setProjectCover: Operation<Edit & { fileId: Uuid }, Saved>
}

export type TaskRow = {
  id: Uuid; projectId: Uuid; body: string; completed: boolean
  dueDate: IsoDate | null; createdAt: IsoDateTime; revision: number
  assigneeId: Uuid | null; assigneeName: string | null
}
export type TaskAssignee = { id: Uuid; name: string; role: ProjectRole }

export interface TasksApi {
  listTasks: Operation<
    { projectId: Uuid },
    { open: TaskRow[]; completed: TaskRow[]; openCount: number; completedCount: number; canWrite: boolean; assignees: TaskAssignee[] }
  >
  createTask: Operation<
    { requestId: Uuid; projectId: Uuid; body: string; dueDate: IsoDate | null; completed: boolean; assigneeId?: Uuid | null },
    Saved
  >
  updateTask: Operation<Edit & { body: string; dueDate: IsoDate | null; assigneeId?: Uuid | null }, Saved>
  setTaskCompleted: Operation<Edit & { completed: boolean }, Saved>
  deleteTask: Operation<Edit, null>
}

export type DocumentCategory = 'specification' | 'plans' | 'additional_plans' | 'renderings'
export type DocumentAccess =
  | { mode: 'owner' }
  | { mode: 'all' }
  | { mode: 'selected'; userIds: Uuid[] }
export type DocumentRow = {
  id: Uuid; projectId: Uuid; category: DocumentCategory; file: FileRef
  uploadedByName: string; createdAt: IsoDateTime; archived: boolean; revision: number
  access?: DocumentAccess // owner only
}

export type AccessCandidate = { userId: Uuid; fullName: string }

export interface FilesApi {
  listAccessCandidates: Operation<{ projectId: Uuid }, AccessCandidate[]>
  listDocuments: Operation<
    { projectId: Uuid; category?: DocumentCategory; search?: string; archived?: boolean },
    { items: DocumentRow[]; countByCategory: Record<DocumentCategory, number> }
  >
  getDocument: Operation<{ id: Uuid }, DocumentRow>
  createDocument: Operation<
    {
      projectId: Uuid; fileId: Uuid; category: DocumentCategory
      access: DocumentAccess // set by the uploader, owner or manager
      replacesDocumentId?: Uuid // owner only
    },
    Saved
  >
  setDocumentAccess: Operation<Edit & { access: DocumentAccess }, Saved>
  setDocumentArchived: Operation<Edit & { archived: boolean }, Saved>
}

export type DateRange = { from?: IsoDate; to?: IsoDate } // inclusive
export type DiaryRow = {
  id: Uuid; projectId: Uuid; projectName: string; workDate: IsoDate; body: string
  reporterId: Uuid; reporterName: string; enteredAt: IsoDateTime
  editedAt: IsoDateTime | null; editedByName: string | null
  cancelledAt: IsoDateTime | null; files: FileRef[]; revision: number
  canCorrect: boolean; canMoveOrCancel: boolean
}
export type DiaryVersion = {
  version: number; kind: 'created' | 'corrected' | 'moved' | 'cancelled'
  projectId: Uuid; workDate: IsoDate; body: string; reporterName: string
  editorName: string; createdAt: IsoDateTime; files: FileRef[]
}
export type DiarySummary = {
  reportCount: number; workDays: number
  byProject: { projectId: Uuid; projectName: string; reportCount: number; workDays: number }[]
}

export interface DiaryApi {
  listEntries: Operation<
    DateRange & { projectId?: Uuid; cancelled?: boolean; cursor?: string },
    Page<DiaryRow>
  >
  getSummary: Operation<DateRange & { projectId?: Uuid }, DiarySummary>
  getEntry: Operation<{ id: Uuid }, DiaryRow>
  listVersions: Operation<{ id: Uuid }, DiaryVersion[]>
  listForReport: Operation<{ scope: ReportScope }, DiaryRow[]>
  createEntry: Operation<
    { requestId: Uuid; projectId: Uuid; workDate: IsoDate; body: string; fileIds: Uuid[] },
    Saved
  >
  correctEntry: Operation<Edit & { body: string; fileIds: Uuid[] }, Saved>
  moveEntry: Operation<Edit & { projectId: Uuid; workDate: IsoDate }, Saved>
  cancelEntry: Operation<Edit, Saved>
}

export type ReportScope =
  | { kind: 'entry'; entryId: Uuid }
  | { kind: 'day'; projectId: Uuid; date: IsoDate }
  | { kind: 'range'; projectId: Uuid; from: IsoDate; to: IsoDate }

export type TransactionKind = 'income' | 'income_refund' | 'expense' | 'expense_credit'
export type TransactionFields = Month & {
  day: number | null; kind: TransactionKind; amount: Agorot; details: string
}
export type TransactionRow = TransactionFields & {
  id: Uuid; position: number; cancelledAt: IsoDateTime | null; revision: number
}
export type RawMonthTotals = Month & { income: Agorot; expense: Agorot } // net of credits
export type MoneySummary = {
  income: Agorot
  expense: Agorot // before tax
  tax: Agorot
  totalExpense: Agorot // expense + tax
  netProfit: Agorot
  profitPercentTenths: number | null // 370 = 37.0%
}
export type MonthSummary = Month & MoneySummary & { balance: Agorot }
export type FinanceFilter = { period: 'all' | Month; day?: number; search?: string }
export type MonthBlock = {
  summary: MonthSummary; incomeRows: TransactionRow[]; expenseRows: TransactionRow[]
}
export type FinanceBook = {
  projectId: Uuid; projectName: string; filter: FinanceFilter
  months: MonthBlock[]
  period: MoneySummary & { balance: Agorot }
  filteredRows: { income: Agorot; expense: Agorot }
  workDays: number
  excelLink: { url: string | null; revision: number }
  canWrite: boolean; canCancel: boolean
}

export interface Money {
  parseShekels(text: string): Result<Agorot>
  taxForMonth(income: Agorot): Agorot
  summarizeMonth(raw: RawMonthTotals, previousBalance: Agorot): MonthSummary
  buildMonths(raw: RawMonthTotals[], through?: Month): MonthSummary[]
  summarizePeriod(months: MonthSummary[]): MoneySummary & { balance: Agorot }
}

export interface FinanceApi {
  getBook: Operation<{ projectId: Uuid; filter: FinanceFilter }, FinanceBook>
  listCancelled: Operation<{ projectId: Uuid }, TransactionRow[]>
  getAllProjectTotals: Operation<
    { from?: Month; to?: Month },
    { projectId: Uuid; projectName: string; month: MonthSummary }[]
  >
  createTransaction: Operation<{ requestId: Uuid; projectId: Uuid; fields: TransactionFields }, Saved>
  updateTransaction: Operation<Edit & { fields: TransactionFields }, Saved>
  cancelTransaction: Operation<Edit, Saved>
  setExcelLink: Operation<{ projectId: Uuid; url: string | null; expectedRevision: number }, Saved>
}

export type HomeData = {
  counters: {
    activeProjects: number; reportsToday: number; customers: number; openTasks: number
    /** Open tasks assigned to the signed-in user (A-46), and the project to open when they are all in one. */
    myOpenTasks: number; myTasksProjectId: Uuid | null
  }
  projects: ProjectCard[]
  financeCube: (MoneySummary & { month: Month }) | null // owner only
}
export type TransferMonth = {
  month: Month; transferAmount: Agorot
  projects: { projectId: Uuid; projectName: string; summary: MonthSummary }[]
}

export interface OverviewApi {
  getHome: Operation<Record<string, never>, HomeData>
  getTransferSummary: Operation<{ from?: Month; to?: Month }, TransferMonth[]>
}

export type ReportPlan = {
  scope: ReportScope; partCount: number; entryCount: number; workDays: number
}
export type BinaryArtifact = { fileName: string; contentType: string; stream: ReadableStream<Uint8Array> }

export interface ReportsApi {
  planReport: Operation<{ scope: ReportScope }, ReportPlan>
  renderReportPart: Operation<{ scope: ReportScope; part: number }, BinaryArtifact>
}

export interface FinanceExportApi {
  renderWorkbook: Operation<{ projectId: Uuid; filter: FinanceFilter }, BinaryArtifact>
}

export * from './schemas';
