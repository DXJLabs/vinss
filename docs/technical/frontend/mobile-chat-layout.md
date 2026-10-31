# Mobile conversation layout and mode control

The room mode control is a compact single-row Shield switch with a visible current-mode label and a collapsible info disclosure. Turning Shield off selects Unshield. Busy/error/public-configuration guards and the existing room-scoped mode handler remain in place. Existing escrow agreements retain their original execution mode.

At widths below 1024px, direct and group timelines participate in normal page flow, without a nested fixed-height/overscroll-contained viewport. Vertical dragging across a message or empty space scrolls the page toward earlier messages, actions, and composer. On desktop, messages retain a bounded internal scroll area; children do not flex-shrink to fit that area.

`useConversationScroll` owns initial/latest positioning and follow intent. Direct and group data hooks no longer invoke scrollIntoView during polling. Pointer input and upward wheel input pause following; scroll/resize measurements select the correct distance metric for page flow versus internal scrolling. A desktop latest jump scrolls only the timeline, avoiding unintended movement of the whole page. Polling appends follow only when the reader was already following the latest messages.

Validation: 44 frontend runtime results, 61 root regression tests, privacy boundary checks, TypeScript, and production compilation were checked. Browser automation could not run because the Chromium download produced an invalid archive. Gesture behavior in Ready X/Android still needs verification on the actual device. Any generated UI reference is a design preview, not browser-test evidence. No contract, fee, or encryption changes accompany this layout change.
