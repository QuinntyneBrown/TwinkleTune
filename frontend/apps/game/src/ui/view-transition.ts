let activeTransition: ViewTransition | null = null

export function updateWithViewTransition(update: () => void, enabled: boolean): void {
  const startViewTransition = (
    document as unknown as { startViewTransition?: (callback: () => void) => ViewTransition }
  ).startViewTransition
  if (!enabled || !startViewTransition) {
    update()
    return
  }

  activeTransition?.skipTransition()
  const transition = startViewTransition.call(document, update)
  activeTransition = transition
  void transition.finished
    .catch(() => {
      /* a superseded transition is expected during quick navigation */
    })
    .finally(() => {
      if (activeTransition === transition) activeTransition = null
    })
}
