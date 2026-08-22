import Link from "next/link";
import { bootstrapAdmin } from "../../lib/admin";
import { AdminDashboard } from "./AdminDashboard";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user, isAdmin } = await bootstrapAdmin();

  if (!isAdmin) {
    return (
      <main className={styles.shell}>
        <section className={styles.denied}>
          <p>JDFC ARCHIVE ADMIN</p>
          <h1>此账号没有管理权限</h1>
          <Link href="/">返回球队网站</Link>
        </section>
      </main>
    );
  }

  return <AdminDashboard displayName={user.displayName} />;
}
