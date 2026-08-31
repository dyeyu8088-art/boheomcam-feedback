<template>
  <teleport to="body">
    <transition name="fade">
      <div v-if="modelValue" class="mask" @click.self="close">
        <transition name="pop" appear>
          <div class="sheet glass" :style="{ maxWidth: width }">
            <header v-if="title">
              <h3>{{ title }}</h3>
              <button class="x" :aria-label="'close'" @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" /></svg>
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
  max-height: 84vh;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-modal);
  box-shadow: var(--shadow-card);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 10px;
}
h3 {
  margin: 0;
  font-size: 17px;
  color: var(--gold-champagne);
  letter-spacing: 0.05em;
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
  padding: 6px 20px 20px;
  overflow-y: auto;
}
</style>
