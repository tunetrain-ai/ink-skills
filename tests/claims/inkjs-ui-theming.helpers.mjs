// Fixtures for the inkjs-ui-theming claims.
import { h, ui } from './inkjs-ui-inputs.helpers.mjs';

/** A theme whose every style/config function is wrapped to record `[component, key, args]`. */
export function spied(theme) {
  const calls = [];
  const wrapped = { components: {} };
  for (const [name, component] of Object.entries(theme.components)) {
    wrapped.components[name] = {};
    if (component.styles) {
      wrapped.components[name].styles = Object.fromEntries(
        Object.entries(component.styles).map(([key, fn]) => [
          key,
          (...args) => {
            calls.push([name, key, args]);
            return fn(...args);
          },
        ]),
      );
    }
    if (component.config) {
      wrapped.components[name].config = (...args) => {
        calls.push([name, 'config', args]);
        return component.config(...args);
      };
    }
  }
  return { theme: wrapped, calls };
}

const OPTIONS = [
  { label: 'Red', value: 'red' },
  { label: 'Green', value: 'green' },
];

/**
 * One scene per component: what to render and one style key that visibly changes the output
 * when overridden with a text color (the scenes are keyed by the names the library's own theme uses).
 */
export function scenes(Text) {
  const listItem = (List) => h(List, null, h(List.Item, null, h(Text, null, 'item')));
  return {
    Alert: { element: h(ui.Alert, { variant: 'info' }, 'msg'), key: 'message' },
    Badge: { element: h(ui.Badge, null, 'tag'), key: 'label' },
    ConfirmInput: { element: h(ui.ConfirmInput, { onConfirm() {}, onCancel() {} }), key: 'input' },
    EmailInput: { element: h(ui.EmailInput, { defaultValue: 'a@b.c' }), key: 'value' },
    MultiSelect: { element: h(ui.MultiSelect, { options: OPTIONS }), key: 'label' },
    OrderedList: { element: listItem(ui.OrderedList), key: 'marker' },
    PasswordInput: { element: h(ui.PasswordInput, { placeholder: 'pw' }), key: 'value' },
    ProgressBar: { element: h(ui.ProgressBar, { value: 50 }), key: 'completed' },
    Select: { element: h(ui.Select, { options: OPTIONS }), key: 'label' },
    Spinner: { element: h(ui.Spinner, { label: 'busy' }), key: 'frame' },
    StatusMessage: { element: h(ui.StatusMessage, { variant: 'info' }, 'msg'), key: 'message' },
    TextInput: { element: h(ui.TextInput, { defaultValue: 'abc' }), key: 'value' },
    UnorderedList: { element: listItem(ui.UnorderedList), key: 'marker' },
  };
}
