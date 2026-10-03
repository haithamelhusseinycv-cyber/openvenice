export function FullscreenButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label="Open image full screen"
    className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-base font-semibold text-black active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" /></svg>
    Full screen
  </button>
}
