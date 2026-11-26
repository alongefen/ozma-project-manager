export const useRouter = () => ({ refresh: () => { window.fixture.refreshes++; }, push: () => {} });
export const useParams = () => ({});
export const usePathname = () => '/diary';
export const useSearchParams = () => new URLSearchParams();
