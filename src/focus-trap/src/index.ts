import {
  h,
  defineComponent,
  watchEffect,
  ref,
  Fragment,
  onMounted,
  onBeforeUnmount
} from 'vue'
import { createId } from 'seemly'
import { focusFirstDescendant, focusLastDescendant } from './utils'

let stack: string[] = []

export const FocusTrap = defineComponent({
  name: 'FocusTrap',
  props: {
    active: Boolean,
    focusFirstDescendant: Boolean
  },
  setup (props) {
    const id = createId()
    const focusableStartRef = ref<HTMLElement | null>(null)
    const focusableEndRef = ref<HTMLElement | null>(null)
    let activated = false
    let ignoreInternalFocusChange = false
    const lastFocusedElement: Element | null = document.activeElement

    function isCurrentActive (): boolean {
      const currentActiveId = stack[stack.length - 1]
      return currentActiveId === id
    }

    // I can't use onMounted in watchEffect
    onMounted(() => {
      watchEffect(() => {
        if (props.active) {
          activate()
        } else if (activated) {
          deactivate()
        }
      })
    })
    onBeforeUnmount(() => {
      if (activated) deactivate()
    })

    function handleDocumentFocus (e: FocusEvent): void {
      if (ignoreInternalFocusChange) return
      if (isCurrentActive()) {
        const mainEl = getMainEl()
        if (mainEl === null) return
        if (mainEl.contains(e.target as any)) return
        // I don't handle shift + tab status since it's too tricky to handle
        resetFocusTo('first')
      }
    }

    function getMainEl (): ChildNode | null {
      const focusableStartEl = focusableStartRef.value
      if (focusableStartEl === null) return null
      let mainEl: ChildNode | null = focusableStartEl
      while (true) {
        mainEl = mainEl.nextSibling
        if (mainEl === null) break
        if (mainEl instanceof Element && mainEl.tagName === 'DIV') {
          break
        }
      }
      return mainEl
    }
    function activate (): void {
      stack.push(id)
      resetFocusTo('first')
      activated = true
      document.addEventListener('focus', handleDocumentFocus, true)
    }
    function deactivate (): void {
      document.removeEventListener('focus', handleDocumentFocus, true)
      stack = stack.filter((idInStack) => idInStack !== id)
      if (isCurrentActive()) return
      if (lastFocusedElement instanceof HTMLElement) {
        ignoreInternalFocusChange = true
        lastFocusedElement.focus()
        ignoreInternalFocusChange = false
      }
    }
    function resetFocusTo (target: 'last' | 'first'): void {
      if (!isCurrentActive()) return
      if (props.active && props.focusFirstDescendant) {
        const focusableStartEl = focusableStartRef.value
        const focusableEndEl = focusableEndRef.value
        if (focusableStartEl !== null && focusableEndEl !== null) {
          const mainEl = getMainEl()
          if (mainEl == null || mainEl === focusableEndEl) {
            ignoreInternalFocusChange = true
            focusableStartEl.focus()
            ignoreInternalFocusChange = false
            return
          }
          ignoreInternalFocusChange = true

          const focused =
            target === 'first'
              ? focusFirstDescendant(mainEl)
              : focusLastDescendant(mainEl)
          ignoreInternalFocusChange = false
          if (!focused) {
            ignoreInternalFocusChange = true
            focusableStartEl.focus()
            ignoreInternalFocusChange = false
          }
        }
      }
    }
    function handleStartFocus (): void {
      if (ignoreInternalFocusChange) return
      resetFocusTo('last')
    }
    function handleEndFocus (e: FocusEvent): void {
      if (
        e.relatedTarget !== null &&
        e.relatedTarget === focusableStartRef.value
      ) {
        resetFocusTo('last')
      } else {
        resetFocusTo('first')
      }
    }
    return {
      focusableStartRef,
      focusableEndRef,
      focusableStyle: 'position: absolute; height: 0; width: 0;',
      handleStartFocus,
      handleEndFocus
    }
  },
  render () {
    const { default: defaultSlot } = this.$slots
    if (defaultSlot === undefined) return null
    const { active, focusableStyle } = this
    return h(Fragment, null, [
      h('div', {
        ariaHidden: 'true',
        tabindex: active ? '0' : '-1',
        ref: 'focusableStartRef',
        style: focusableStyle,
        onFocus: this.handleStartFocus
      }),
      defaultSlot(),
      h('div', {
        ariaHidden: 'true',
        style: focusableStyle,
        ref: 'focusableEndRef',
        tabindex: active ? '0' : '-1',
        onFocus: this.handleEndFocus
      })
    ])
  }
})