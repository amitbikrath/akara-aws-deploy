// The homepage is just the mount point — the entire UI is rendered into #root
// by the Babel/React bundle that layout.tsx loads from public/akara/*.jsx.
export default function HomePage() {
  return <div id="root" />;
}
