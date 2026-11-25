import { z } from 'zod';

export const ResultSchema = <T extends z.ZodType>(value: T) => z.discriminatedUnion('ok',[z.strictObject({ok:z.literal(true),value}),z.strictObject({ok:z.literal(false),error:z.lazy(()=>AppErrorSchema)})]);
export const PageSchema = <T extends z.ZodType>(item:T) => z.strictObject({items:z.array(item),nextCursor:z.string().nullable()});

export const UuidSchema = z.uuid();

export const IsoDateSchema = z.iso.date();

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

export const AgorotSchema = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);

export const MonthSchema = z.strictObject({year:z.number().int().min(2000).max(2100),month:z.number().int().min(1).max(12)});

export const ErrorCodeSchema = z.union([z.literal('UNAUTHENTICATED'),z.literal('FORBIDDEN'),z.literal('NOT_FOUND'),z.literal('VALIDATION'),z.literal('CONFLICT'),z.literal('PROJECT_READ_ONLY'),z.literal('LIMIT'),z.literal('RATE_LIMITED'),z.literal('UNAVAILABLE')]);

export const AppErrorSchema = z.strictObject({"code": ErrorCodeSchema,"message": z.string(),"fieldErrors": z.record(z.string(),z.string()).optional()});

export const ActorSchema = z.strictObject({"userId": UuidSchema,"fullName": z.string().trim().min(1).max(120),"email": z.email(),"isOwner": z.boolean()});

export const ProjectRoleSchema = z.union([z.literal('manager'),z.literal('worker')]);

export const SavedSchema = z.strictObject({id:UuidSchema,revision:z.number().int().positive()});

export const EditSchema = z.strictObject({id:UuidSchema,expectedRevision:z.number().int().positive()});

export const ProjectPermissionsSchema = z.strictObject({"view": z.boolean(),"editDetails": z.boolean(),"uploadDocument": z.boolean(),"manageAccess": z.boolean(),"writeTasks": z.boolean(),"deleteTasks": z.boolean(),"report": z.boolean(),"viewFinance": z.boolean(),"writeFinance": z.boolean(),"cancelTransaction": z.boolean()});

export const FilePurposeSchema = z.union([z.literal('document'),z.literal('diary'),z.literal('cover')]);

export const FileRefSchema = z.strictObject({"id": UuidSchema,"name": z.string().trim().min(1).max(255),"mime": z.enum(["application/pdf","image/jpeg","image/png","image/webp","image/heic","image/heif","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation"]),"sizeBytes": z.number().int().positive().max(52428800),"displayState": z.union([z.literal('none'),z.literal('ready'),z.literal('failed')])});

export const UploadRequestSchema = z.strictObject({"purpose": FilePurposeSchema,"projectId": UuidSchema,"files": z.array(z.strictObject({"clientId": UuidSchema,"name": z.string().trim().min(1).max(255),"mime": z.enum(["application/pdf","image/jpeg","image/png","image/webp","image/heic","image/heif","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation"]),"sizeBytes": z.number().int().positive().max(52428800)})).min(1).max(20)});

export const UploadTargetSchema = z.strictObject({"clientId": UuidSchema,"target": ResultSchema(z.strictObject({"fileId": UuidSchema,"endpoint": z.string(),"publishableKey": z.string(),"token": z.string(),"bucket": z.string(),"path": z.string()}))});

export const SensitiveEventSchema = z.strictObject({"id": z.number().finite(),"occurredAt": IsoDateTimeSchema,"actorName": z.string(),"action": z.string(),"entityType": z.string(),"entityId": z.string(),"projectId": z.union([UuidSchema,z.null()]),"before": z.unknown(),"after": z.unknown()});

export const UserAssignmentSchema = z.strictObject({"projectId": UuidSchema,"projectName": z.string(),"role": ProjectRoleSchema,"financeAccess": z.boolean(),"revision": z.number().int().positive()});

export const UserRowSchema = z.strictObject({"id": UuidSchema,"fullName": z.string().trim().min(1).max(120),"email": z.email(),"isOwner": z.boolean(),"isActive": z.boolean(),"revision": z.number().int().positive(),"assignments": z.array(UserAssignmentSchema)});

export const MemberRowSchema = z.strictObject({"userId": UuidSchema,"fullName": z.string().trim().min(1).max(120),"role": ProjectRoleSchema,"financeAccess": z.boolean(),"isActive": z.boolean(),"revision": z.number().int().positive()});

export const ProjectStatusSchema = z.union([z.literal('active'),z.literal('completed')]);

export const ProjectFieldsSchema = z.strictObject({name:z.string().trim().min(1).max(200),businessName:z.string().trim().min(1).max(200),siteAddress:z.string().trim().min(1).max(300),contact:z.strictObject({name:z.string().trim().min(1).max(120),phone:z.string().trim().min(1).max(40),email:z.email().nullable(),roleTitle:z.string().max(120).nullable()}),startDate:IsoDateSchema.nullable(),endDate:IsoDateSchema.nullable(),accessNotes:z.string().max(2000).nullable(),businessNumber:z.string().max(30).nullable().optional()}).refine(v=>!v.startDate||!v.endDate||v.endDate>=v.startDate,{message:'תאריך הסיום קודם להתחלה',path:['endDate']});

export const ProjectCardSchema = z.strictObject({"id": UuidSchema,"name": z.string(),"businessName": z.string(),"siteAddress": z.string(),"status": ProjectStatusSchema,"archived": z.boolean(),"coverFileId": z.union([UuidSchema,z.null()]),"reportCount": z.number().finite(),"openTaskCount": z.number().finite()});

export const ProjectDetailsSchema = ProjectFieldsSchema.safeExtend(z.strictObject({"id": UuidSchema,"status": ProjectStatusSchema,"archived": z.boolean(),"revision": z.number().int().positive(),"coverFileId": z.union([UuidSchema,z.null()]),"managerNames": z.array(z.string()),"permissions": ProjectPermissionsSchema}).shape);

export const TaskRowSchema = z.strictObject({"id": UuidSchema,"projectId": UuidSchema,"body": z.string(),"completed": z.boolean(),"dueDate": z.union([IsoDateSchema,z.null()]),"createdAt": IsoDateTimeSchema,"revision": z.number().int().positive(),"assigneeId": z.union([UuidSchema,z.null()]),"assigneeName": z.union([z.string(),z.null()])});

export const DocumentCategorySchema = z.union([z.literal('specification'),z.literal('plans'),z.literal('additional_plans'),z.literal('renderings')]);

export const DocumentAccessSchema = z.union([z.strictObject({"mode": z.literal('owner')}),z.strictObject({"mode": z.literal('all')}),z.strictObject({"mode": z.literal('selected'),"userIds": z.array(UuidSchema).min(1).refine(v=>new Set(v).size===v.length)})]);

export const DocumentRowSchema = z.strictObject({"id": UuidSchema,"projectId": UuidSchema,"category": DocumentCategorySchema,"file": FileRefSchema,"uploadedByName": z.string(),"createdAt": IsoDateTimeSchema,"archived": z.boolean(),"revision": z.number().int().positive(),"access": DocumentAccessSchema.optional()});

export const AccessCandidateSchema = z.strictObject({"userId": UuidSchema,"fullName": z.string().trim().min(1).max(120)});

export const DateRangeSchema = z.strictObject({"from": IsoDateSchema.optional(),"to": IsoDateSchema.optional()});

export const DiaryRowSchema = z.strictObject({"id": UuidSchema,"projectId": UuidSchema,"projectName": z.string(),"workDate": IsoDateSchema,"body": z.string(),"reporterId": UuidSchema,"reporterName": z.string(),"enteredAt": IsoDateTimeSchema,"editedAt": z.union([IsoDateTimeSchema,z.null()]),"editedByName": z.union([z.string(),z.null()]),"cancelledAt": z.union([IsoDateTimeSchema,z.null()]),"files": z.array(FileRefSchema),"revision": z.number().int().positive(),"canCorrect": z.boolean(),"canMoveOrCancel": z.boolean()});

export const DiaryVersionSchema = z.strictObject({"version": z.number().finite(),"kind": z.union([z.literal('created'),z.literal('corrected'),z.literal('moved'),z.literal('cancelled')]),"projectId": UuidSchema,"workDate": IsoDateSchema,"body": z.string(),"reporterName": z.string(),"editorName": z.string(),"createdAt": IsoDateTimeSchema,"files": z.array(FileRefSchema)});

export const DiarySummarySchema = z.strictObject({"reportCount": z.number().finite(),"workDays": z.number().finite(),"byProject": z.array(z.strictObject({"projectId": UuidSchema,"projectName": z.string(),"reportCount": z.number().finite(),"workDays": z.number().finite()}))});

export const ReportScopeSchema = z.union([z.strictObject({"kind": z.literal('entry'),"entryId": UuidSchema}),z.strictObject({"kind": z.literal('day'),"projectId": UuidSchema,"date": IsoDateSchema}),z.strictObject({"kind": z.literal('range'),"projectId": UuidSchema,"from": IsoDateSchema,"to": IsoDateSchema})]);

export const TransactionKindSchema = z.union([z.literal('income'),z.literal('income_refund'),z.literal('expense'),z.literal('expense_credit')]);

export const TransactionFieldsSchema = z.strictObject({year:z.number().int().min(2000).max(2100),month:z.number().int().min(1).max(12),day:z.number().int().min(1).max(31).nullable(),kind:TransactionKindSchema,amount:AgorotSchema.min(1).max(100000000000),details:z.string().trim().min(1).max(500)}).refine(v=>v.day===null||v.day<=new Date(Date.UTC(v.year,v.month,0)).getUTCDate(),{message:'יום לא תקין בחודש',path:['day']});

export const TransactionRowSchema = TransactionFieldsSchema.safeExtend(z.strictObject({"id": UuidSchema,"position": z.number().finite(),"cancelledAt": z.union([IsoDateTimeSchema,z.null()]),"revision": z.number().int().positive()}).shape);

export const RawMonthTotalsSchema = MonthSchema.safeExtend(z.strictObject({"income": AgorotSchema,"expense": AgorotSchema}).shape);

export const MoneySummarySchema = z.strictObject({"income": AgorotSchema,"expense": AgorotSchema,"tax": AgorotSchema,"totalExpense": AgorotSchema,"netProfit": AgorotSchema,"profitPercentTenths": z.union([z.number().int(),z.null()])});

export const MonthSummarySchema = MonthSchema.safeExtend(MoneySummarySchema.shape).safeExtend(z.strictObject({"balance": AgorotSchema}).shape);

export const FinanceFilterSchema = z.strictObject({"period": z.union([z.literal('all'),MonthSchema]),"day": z.number().finite().optional(),"search": z.string().optional()});

export const MonthBlockSchema = z.strictObject({"summary": MonthSummarySchema,"incomeRows": z.array(TransactionRowSchema),"expenseRows": z.array(TransactionRowSchema)});

export const FinanceBookSchema = z.strictObject({"projectId": UuidSchema,"projectName": z.string(),"filter": FinanceFilterSchema,"months": z.array(MonthBlockSchema),"period": MoneySummarySchema.safeExtend(z.strictObject({"balance": AgorotSchema}).shape),"filteredRows": z.strictObject({"income": AgorotSchema,"expense": AgorotSchema}),"workDays": z.number().finite(),"excelLink": z.strictObject({"url": z.union([z.url({protocol:/^https$/}).max(2000),z.null()]),"revision": z.number().int().positive()}),"canWrite": z.boolean(),"canCancel": z.boolean()});

export const HomeDataSchema = z.strictObject({"counters": z.strictObject({"activeProjects": z.number().finite(),"reportsToday": z.number().finite(),"customers": z.number().finite(),"openTasks": z.number().finite(),"myOpenTasks": z.number().finite(),"myTasksProjectId": z.union([UuidSchema,z.null()])}),"projects": z.array(ProjectCardSchema),"financeCube": z.union([MoneySummarySchema.safeExtend(z.strictObject({"month": MonthSchema}).shape),z.null()])});

export const TransferMonthSchema = z.strictObject({"month": MonthSchema,"transferAmount": AgorotSchema,"projects": z.array(z.strictObject({"projectId": UuidSchema,"projectName": z.string(),"summary": MonthSummarySchema}))});

export const ReportPlanSchema = z.strictObject({"scope": ReportScopeSchema,"partCount": z.number().finite(),"entryCount": z.number().finite(),"workDays": z.number().finite()});

export const CreateProfileInputSchema = z.strictObject({ requestId: UuidSchema, email: z.email(), fullName: z.string().trim().min(1).max(120) });
export const ProfileCreationResultSchema = SavedSchema.safeExtend({ passwordPending: z.boolean() });
export const PrepareProfileUpdateInputSchema = EditSchema.safeExtend({ fullName: z.string().trim().min(1).max(120), email: z.email() });
export const ProfileUpdateResultSchema = SavedSchema.safeExtend({ emailPending: z.boolean() });
export const CompleteProfileCreationInputSchema = z.strictObject({ requestId: UuidSchema, userId: UuidSchema });
const UploadCompletionBaseSchema = z.strictObject({
  fileId: UuidSchema, projectId: UuidSchema, uploadedBy: UuidSchema, purpose: FilePurposeSchema,
  bucket: z.string(), path: z.string(), name: z.string(), declaredMime: z.string(), declaredSize: z.number().int().positive(),
});
export const UploadCompletionSchema = z.discriminatedUnion('state', [
  UploadCompletionBaseSchema.safeExtend({ state: z.literal('pending'), fileRef: z.null() }),
  UploadCompletionBaseSchema.safeExtend({ state: z.literal('rejected'), fileRef: z.null() }),
  UploadCompletionBaseSchema.safeExtend({ state: z.literal('ready'), fileRef: FileRefSchema }),
]);

export const AuthAdminInputSchemas = {
createUser: z.strictObject({"requestId": UuidSchema,"email": z.email(),"fullName": z.string().trim().min(1).max(120),"password": z.string().min(8)}),
setPassword: z.strictObject({"userId": UuidSchema,"password": z.string().min(8)}),
setEmail: z.strictObject({"userId": UuidSchema,"expectedRevision": z.number().int().positive(),"fullName": z.string().trim().min(1).max(120),"email": z.email()}),
} as const;
export const StorageServiceInputSchemas = {
beginUpload: UploadRequestSchema,
finishUpload: z.strictObject({"fileId": UuidSchema}),
getSignedUrl: z.strictObject({"fileId": UuidSchema,"variant": z.union([z.literal('original'),z.literal('display')]),"download": z.boolean()}),
readBytes: z.strictObject({"fileId": UuidSchema,"variant": z.union([z.literal('original'),z.literal('display')])}),
} as const;
export const PermissionServiceInputSchemas = {
forProject: z.strictObject({"projectId": UuidSchema}),
requireOwner: z.record(z.string(),z.never()),
} as const;
export const AuditServiceInputSchemas = {
list: z.strictObject({"projectId": UuidSchema.optional(),"cursor": z.string().optional()}),
} as const;
export const UsersApiInputSchemas = {
listUsers: z.strictObject({"search": z.string().optional()}),
getUser: z.strictObject({"id": UuidSchema}),
listProjectMembers: z.strictObject({"projectId": UuidSchema}),
createUser: z.strictObject({"requestId": UuidSchema,"email": z.email(),"fullName": z.string().trim().min(1).max(120),"password": z.string().min(8)}),
updateUser: EditSchema.safeExtend(z.strictObject({"fullName": z.string().trim().min(1).max(120),"email": z.email()}).shape),
setUserActive: EditSchema.safeExtend(z.strictObject({"active": z.boolean()}).shape),
resetPassword: z.strictObject({"id": UuidSchema,"password": z.string().min(8)}),
setMembership: z.strictObject({"userId": UuidSchema,"projectId": UuidSchema,"role": ProjectRoleSchema,"expectedRevision": z.union([z.number().int().positive(),z.null()])}),
removeMembership: z.strictObject({"userId": UuidSchema,"projectId": UuidSchema,"expectedRevision": z.number().int().positive()}),
setFinanceAccess: z.strictObject({"userId": UuidSchema,"projectId": UuidSchema,"enabled": z.boolean(),"expectedRevision": z.number().int().positive()}),
} as const;
export const ProjectsApiInputSchemas = {
listProjects: z.strictObject({"search": z.string().optional(),"status": ProjectStatusSchema.optional(),"archived": z.boolean().optional()}),
getProject: z.strictObject({"id": UuidSchema}),
createProject: z.strictObject({"requestId": UuidSchema,"fields": ProjectFieldsSchema}),
updateProject: EditSchema.safeExtend(z.strictObject({"fields": ProjectFieldsSchema}).shape),
setProjectStatus: EditSchema.safeExtend(z.strictObject({"status": ProjectStatusSchema}).shape),
setProjectArchived: EditSchema.safeExtend(z.strictObject({"archived": z.boolean()}).shape),
setProjectCover: EditSchema.safeExtend(z.strictObject({"fileId": UuidSchema}).shape),
} as const;
export const TasksApiInputSchemas = {
listTasks: z.strictObject({"projectId": UuidSchema}),
createTask: z.strictObject({"requestId": UuidSchema,"projectId": UuidSchema,"body": z.string().trim().min(1).max(2000),"dueDate": z.union([IsoDateSchema,z.null()]),"completed": z.boolean(),"assigneeId": z.union([UuidSchema,z.null()]).optional()}),
updateTask: EditSchema.safeExtend(z.strictObject({"body": z.string().trim().min(1).max(2000),"dueDate": z.union([IsoDateSchema,z.null()]),"assigneeId": z.union([UuidSchema,z.null()]).optional()}).shape),
setTaskCompleted: EditSchema.safeExtend(z.strictObject({"completed": z.boolean()}).shape),
deleteTask: EditSchema,
} as const;
export const FilesApiInputSchemas = {
listAccessCandidates: z.strictObject({"projectId": UuidSchema}),
listDocuments: z.strictObject({"projectId": UuidSchema,"category": DocumentCategorySchema.optional(),"search": z.string().optional(),"archived": z.boolean().optional()}),
getDocument: z.strictObject({"id": UuidSchema}),
createDocument: z.strictObject({"projectId": UuidSchema,"fileId": UuidSchema,"category": DocumentCategorySchema,"access": DocumentAccessSchema,"replacesDocumentId": UuidSchema.optional()}),
setDocumentAccess: EditSchema.safeExtend(z.strictObject({"access": DocumentAccessSchema}).shape),
setDocumentArchived: EditSchema.safeExtend(z.strictObject({"archived": z.boolean()}).shape),
} as const;
export const DiaryApiInputSchemas = {
listEntries: DateRangeSchema.safeExtend(z.strictObject({"projectId": UuidSchema.optional(),"cancelled": z.boolean().optional(),"cursor": z.string().optional()}).shape),
getSummary: DateRangeSchema.safeExtend(z.strictObject({"projectId": UuidSchema.optional()}).shape),
getEntry: z.strictObject({"id": UuidSchema}),
listVersions: z.strictObject({"id": UuidSchema}),
listForReport: z.strictObject({"scope": ReportScopeSchema}),
createEntry: z.strictObject({"requestId": UuidSchema,"projectId": UuidSchema,"workDate": IsoDateSchema,"body": z.string().trim().min(1).max(20000),"fileIds": z.array(UuidSchema).max(20).refine(v=>new Set(v).size===v.length)}),
correctEntry: EditSchema.safeExtend(z.strictObject({"body": z.string().trim().min(1).max(20000),"fileIds": z.array(UuidSchema).max(20).refine(v=>new Set(v).size===v.length)}).shape),
moveEntry: EditSchema.safeExtend(z.strictObject({"projectId": UuidSchema,"workDate": IsoDateSchema}).shape),
cancelEntry: EditSchema,
} as const;
export const FinanceApiInputSchemas = {
getBook: z.strictObject({"projectId": UuidSchema,"filter": FinanceFilterSchema}),
listCancelled: z.strictObject({"projectId": UuidSchema}),
getAllProjectTotals: z.strictObject({"from": MonthSchema.optional(),"to": MonthSchema.optional()}),
createTransaction: z.strictObject({"requestId": UuidSchema,"projectId": UuidSchema,"fields": TransactionFieldsSchema}),
updateTransaction: EditSchema.safeExtend(z.strictObject({"fields": TransactionFieldsSchema}).shape),
cancelTransaction: EditSchema,
setExcelLink: z.strictObject({"projectId": UuidSchema,"url": z.union([z.url({protocol:/^https$/}).max(2000),z.null()]),"expectedRevision": z.number().int().positive()}),
} as const;
export const OverviewApiInputSchemas = {
getHome: z.record(z.string(),z.never()),
getTransferSummary: z.strictObject({"from": MonthSchema.optional(),"to": MonthSchema.optional()}),
} as const;
export const ReportsApiInputSchemas = {
planReport: z.strictObject({"scope": ReportScopeSchema}),
renderReportPart: z.strictObject({"scope": ReportScopeSchema,"part": z.number().finite()}),
} as const;
export const FinanceExportApiInputSchemas = {
renderWorkbook: z.strictObject({"projectId": UuidSchema,"filter": FinanceFilterSchema}),
} as const;


export const AuthSignInSchema = z.strictObject({email:z.email(),password:z.string().min(8)});
