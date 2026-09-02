<template>
  <teleport to="body">
    <transition name="fade">
      <div v-if="modelValue" class="mask" @click.self="close">
        <transition name="pop" appear>
          <div class="sheet glass" :style="{ maxWidth: width }">
            <header v-if="title">
              <h3>{{ title }}</h3>
              <button class="x" aria-label="close" @click="close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
                  <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
                </svg>
              </button>
            </header>
            <div class="body"><slot /></div>
          </div>
        </transition>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: boolean; title?: string; width?: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();
const close = (): void => emit('update:modelValue', false);
void props;
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(6, 8, 12, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px calc(var(--safe-left) + 20px) calc(var(--safe-bottom) + 20px) calc(var(--safe-right) + 20px);
}
.sheet {
  width: 100%;
  max-width: 420px;
  /* 桌面上 84vh 会让弹窗几乎顶满屏，加一个绝对上限 */
  max-height: min(84vh, 760px);
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-modal);
  background: linear-gradient(168deg, rgba(23, 34, 58, 0.96), rgba(11, 17, 29, 0.97));
  border: 1px solid rgba(201, 160, 99, 0.16);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 214, 0.1),
    inset 0 -16px 30px rgba(0, 0, 0, 0.34),
    0 26px 60px rgba(0, 0, 0, 0.62);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px 20px;
  border-bottom: 1px solid rgba(201, 160, 99, 0.12);
}
h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.06em;
  background: linear-gradient(180deg, #fff8e6 6%, #e6cfa3 56%, #b3924f 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.x {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: none;
  border: none;
  border-radius: 9px;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    color 160ms var(--ease-out),
    background 160ms var(--ease-out);
}
.x svg {
  width: 16px;
  height: 16px;
}
.x:hover {
  color: var(--gold-champagne);
  background: rgba(201, 160, 99, 0.1);
}
.body {
  padding: 14px 20px 20px;
  overflow-y: auto;
}
</style>
