<template>
  <teleport to="body">
    <transition name="fade">
      <div v-if="modelValue" class="mask" @click.self="close">
        <transition name="pop" appear>
          <div class="sheet glass" :style="{ maxWidth: width }">
            <header v-if="title">
              <h3>{{ title }}</h3>
              <button class="x" @click="close">✕</button>
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
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 15px;
  cursor: pointer;
  padding: 4px 8px;
}
.body {
  padding: 6px 20px 20px;
  overflow-y: auto;
}
</style>
