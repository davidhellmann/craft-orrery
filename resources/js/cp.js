/**
 * Orrery's control panel section: the viewer in a frame, with buttons to open it fullscreen, in a new tab, or to
 * download it. `ViewerController::index()` sends the props.
 *
 * Craft loads this file on every control panel page, so it only registers the page. Vue comes from the control
 * panel's import map when the page is opened, which is why this needs no build.
 */
window.Cp.booting((cp) => {
    cp.$inertia.register('orrery/Index', async () => {
        const { defineComponent, h, onBeforeUnmount, onMounted, ref, resolveComponent } = await import('vue');

        return defineComponent({
            name: 'OrreryIndex',
            props: {
                title: { type: String, required: true },
                appUrl: { type: String, required: true },
                downloadUrl: { type: String, required: true },
                labels: { type: Object, required: true },
            },
            setup(props) {
                const LayoutSlot = resolveComponent('craft:layout-slot');
                const CpContainer = resolveComponent('craft:cp-container');
                const frame = ref(null);
                // Follows the viewer, so the new tab opens on what the frame shows.
                const newTabUrl = ref(props.appUrl + location.hash);

                // Fill the viewport without scrolling the page, whatever the control panel puts below the frame.
                const fit = () => {
                    const el = frame.value;
                    if (!el) {
                        return;
                    }
                    el.style.height = `${window.innerHeight}px`;
                    const { top, bottom } = el.getBoundingClientRect();
                    const below = document.documentElement.scrollHeight - window.scrollY - bottom;
                    el.style.height = `${Math.max(400, window.innerHeight - top - window.scrollY - below)}px`;
                };

                // The control panel goes on laying itself out after this page is mounted: the buttons land beside
                // the title, styles arrive. Whatever moves the frame resizes something around it, so fit again then.
                // Fitting to the same space sets the same height, which is where this stops.
                const surroundings = new ResizeObserver(fit);

                // The viewer keeps its place in its own hash. Mirror it in the control panel's URL, so a reload or a
                // shared link comes back to the same place.
                const sync = () => {
                    const hash = frame.value.contentWindow.location.hash;
                    history.replaceState(history.state, '', hash || location.pathname + location.search);
                    newTabUrl.value = props.appUrl + hash;
                };
                const onLoad = () => {
                    frame.value.contentWindow.addEventListener('orrery:navigate', sync);
                    sync();
                };

                onMounted(() => {
                    fit();
                    window.addEventListener('resize', fit);
                    for (let el = frame.value.parentElement; el; el = el.parentElement) {
                        surroundings.observe(el);
                    }
                });
                onBeforeUnmount(() => {
                    window.removeEventListener('resize', fit);
                    surroundings.disconnect();
                });

                // The address the frame starts on. It mustn't follow `newTabUrl`, or every step in the viewer would
                // load the frame again.
                const src = newTabUrl.value;

                return () => [
                    h(LayoutSlot, { name: 'content-actions' }, () => [
                        h(
                            'craft-button',
                            { type: 'button', icon: 'expand', onClick: () => frame.value.requestFullscreen() },
                            props.labels.fullscreen,
                        ),
                        // The viewer is a page of its own, not a control panel screen, so Craft mustn't open these
                        // two in its shell: one opens elsewhere, the other downloads.
                        h(
                            'craft-button',
                            { href: newTabUrl.value, target: '_blank', rel: 'noopener', icon: 'arrow-up-right-from-square' },
                            props.labels.newTab,
                        ),
                        h('craft-button', { href: props.downloadUrl, icon: 'download', '^download': '' }, props.labels.download),
                    ]),
                    h(CpContainer, null, () =>
                        h('iframe', { ref: frame, class: 'orrery-frame', title: props.title, src, onLoad }),
                    ),
                ];
            },
        });
    });
});
