// The homepage is just the mount point — the entire UI is rendered into #root
// by the React bundle that layout.tsx loads from public/akara/js/*.js.
//
// #root starts with the boot veil (styles: .ak-boot in akara-site.css). The
// app's first render clears #root, and app.jsx fades a copy of the veil out.
// dangerouslySetInnerHTML makes #root opaque to Next's hydration, so Next
// never fights the app over what is inside it.
const BOOT_HTML =
  '<div class="ak-boot" role="status" aria-label="Akara is loading">' +
  '<div class="ak-boot-in">' +
  '<p class="ak-boot-kicker">Akara · Vol. 01 · Dharma Season</p>' +
  '<div class="ak-boot-rule" aria-hidden="true"><i></i><b></b><i></i></div>' +
  '<div class="ak-boot-mark">Akara</div>' +
  '<p class="ak-boot-dek">' +
  '<span>The edition is being set in type.</span>' +
  '<span>The line is slow — the pages are still arriving.</span>' +
  '<span>If nothing opens, pull down to refresh.</span>' +
  '</p></div>' +
  '<p class="ak-boot-foot">Pune · Varanasi · Kumbakonam</p>' +
  '</div>';

export default function HomePage() {
  return <div id="root" dangerouslySetInnerHTML={{ __html: BOOT_HTML }} />;
}
