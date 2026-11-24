import { StateMessage } from '@/components/ui';

/**
 * Every `notFound()` under the app shell (a forbidden finance page, another project's pages, a malformed id) lands here:
 * the shell stays, one plain Hebrew message and one way back, and no data. The status stays 404 and the text never says
 * whether the page exists (DESIGN 5). The decision to refuse is the server's; this only presents it.
 */
export default function AppNotFound() {
  return <StateMessage backHref="/projects" backLabel="חזרה לפרויקטים">הדף לא נמצא, או שאין לך הרשאה לראות אותו.</StateMessage>;
}
