// Claims for skills/ecosystem/inkjs-ui/inkjs-ui-theming/SKILL.md.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import React from 'react';
import spinners from 'cli-spinners';
import { skill, tsx, runFence, stripAnsi, catchRenderError, ROOT } from '../lib/index.mjs';
import { ui, h, ink, open } from './inkjs-ui-inputs.helpers.mjs';
import { spied, scenes } from './inkjs-ui-theming.helpers.mjs';

const s = skill('inkjs-ui-theming');
const F = 'SKILL.md';
const { Box, Text, renderToString } = ink;
const { ThemeProvider, ThemeContext, defaultTheme, extendTheme, useComponentTheme } = ui;

const EQ = `type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;`;
const render = (element, columns = 40) => renderToString(element, { columns });
const themed = (theme, element) => h(ThemeProvider, { theme }, element);
/** `{components: {[name]: {styles: {[key]: () => style}}}}` merged onto the default theme. */
const override = (name, key, style, base = defaultTheme) => extendTheme(base, { components: { [name]: { styles: { [key]: () => style } } } });
const YELLOW = { color: 'yellow' };
const YELLOW_SGR = '\x1b[33m';
const kebab = (name) => name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
/** The component names the library exports (everything capitalised that is a function, except the provider). */
const exportedComponents = () => Object.keys(ui).filter((name) => /^[A-Z]/.test(name) && typeof ui[name] === 'function' && name !== 'ThemeProvider');

// ===================================================================== description

s.fact(
  F,
  ['Theme @inkjs/ui components with ThemeProvider and extendTheme — override colors/styles per component without forking them, and read the active theme with useComponentTheme.'],
  { kind: 'R' },
  async (t) => {
    for (const name of ['ThemeProvider', 'extendTheme', 'useComponentTheme']) t.equal(typeof ui[name], 'function', `${name} is an export of @inkjs/ui`);
    const plain = render(h(ui.Badge, { color: 'green' }, 'x'));
    const custom = override('Badge', 'label', { color: 'yellow' });
    const out = render(themed(custom, h(ui.Badge, { color: 'green' }, 'x')));
    t.ok(out.includes(`${YELLOW_SGR}X`) && !plain.includes(YELLOW_SGR), 'a color is overridden per component, without touching the component');
    let seen;
    const Probe = () => {
      seen = useComponentTheme('Badge');
      return h(Text, null, 'p');
    };
    render(themed(custom, h(Probe)));
    t.equal(seen, custom.components.Badge, 'and the active theme is read with useComponentTheme');
  },
);

s.guidance(F, ['Use when the user wants to restyle @inkjs/ui components consistently or build a custom design system on top of them.'], 'a recommendation about when to reach for the skill; it asserts nothing about behaviour (each part of theming is exercised by the claims below)');

// ===================================================================== intro

const INTRO = "Every `@inkjs/ui` component reads its styles from a shared `Theme` via React context — apart from `Badge`'s `color`, you don't pass style props to individual components; you override the theme they all read from.";
s.fact(F, [INTRO], { kind: 'R', ctx: ['Theme'] }, async (t, q) => {
  const Badge = q.api(ui, 'Badge');
  const colorProp = q.tok('color');
  const uiModule = await import(q.tok('@inkjs/ui'));
  const components = Object.keys(defaultTheme.components).sort();
  t.deepEqual(components, exportedComponents().sort(), 'every component the library exports has an entry in the shared theme');
  const table = scenes(Text);
  t.deepEqual(Object.keys(table).sort(), components, 'one scene per component');
  for (const name of components) {
    const { element, key } = table[name];
    const base = render(element);
    t.ok(!base.includes(YELLOW_SGR), `${name}: not yellow by default`);
    const changed = render(themed(override(name, key, YELLOW), element));
    t.ok(changed.includes(YELLOW_SGR), `${name}: overriding ${key} in the theme above it changes what it draws`);
    // and it really is the theme that is read: its style functions are the ones called
    const { theme, calls } = spied(defaultTheme);
    render(themed(theme, element));
    t.ok(calls.some(([component, style]) => component === name && style === key), `${name}: calls the ${key} style function of the theme in context`);
    t.ok(calls.every(([component]) => component === name), `${name}: and reads no other component's styles`);
  }
  // the one style prop
  t.ok(render(h(Badge, { [colorProp]: 'green' }, 'x')).includes('\x1b[42m'), 'Badge takes a color prop: the badge background');
  t.equal(typeof uiModule.defaultTheme, 'object', 'the library exports the theme every component falls back to');
});
s.types(F, [INTRO], tsx`
import React from 'react';
import type {BoxProps, TextProps} from 'ink';
import {Alert, Badge, ConfirmInput, EmailInput, MultiSelect, OrderedList, PasswordInput, ProgressBar, Select, Spinner, StatusMessage, TextInput, UnorderedList, type Theme} from '@inkjs/ui';
${EQ}
// the props that style Ink's own <Text> and <Box> (children is content, not style)
type StyleProps = Exclude<keyof TextProps | keyof BoxProps, 'children'>;
type Styled<C extends React.ComponentType<any>> = Extract<keyof React.ComponentProps<C>, StyleProps>;
export const alert: Equal<Styled<typeof Alert>, never> = true;
export const badge: Equal<Styled<typeof Badge>, 'color'> = true;
export const confirm: Equal<Styled<typeof ConfirmInput>, never> = true;
export const email: Equal<Styled<typeof EmailInput>, never> = true;
export const multi: Equal<Styled<typeof MultiSelect>, never> = true;
export const ordered: Equal<Styled<typeof OrderedList>, never> = true;
export const password: Equal<Styled<typeof PasswordInput>, never> = true;
export const progress: Equal<Styled<typeof ProgressBar>, never> = true;
export const select: Equal<Styled<typeof Select>, never> = true;
export const spinner: Equal<Styled<typeof Spinner>, never> = true;
export const status: Equal<Styled<typeof StatusMessage>, never> = true;
export const text: Equal<Styled<typeof TextInput>, never> = true;
export const unordered: Equal<Styled<typeof UnorderedList>, never> = true;
export const theme: Theme = {components: {}};
export const bad = <Spinner color="red" />; //! TS2322
`);

// ===================================================================== ThemeProvider

s.fact(F, ['Wrap a subtree to apply a theme to every `@inkjs/ui` component inside it:'], { kind: 'R' }, async (t, q) => {
  const uiModule = await import(q.tok('@inkjs/ui'));
  const theme = extendTheme(override('Badge', 'label', YELLOW), { components: { Spinner: { styles: { frame: () => YELLOW } } } });
  const tree = (wrap) => h(Box, { flexDirection: 'column' }, h(uiModule.Badge, null, 'outside'), wrap(h(Box, { flexDirection: 'column' }, h(uiModule.Badge, null, 'inside'), h(uiModule.Spinner, { label: 'inside' }))));
  const plain = render(tree((children) => children));
  const wrapped = render(tree((children) => h(uiModule.ThemeProvider, { theme }, children)));
  const [outside, badge, spinner] = wrapped.split('\n');
  t.ok(!plain.includes(YELLOW_SGR), 'by default nothing is yellow');
  t.ok(!outside.includes(YELLOW_SGR), 'a component outside the provider is unchanged');
  t.ok(badge.includes(`${YELLOW_SGR}INSIDE`), 'every component inside it follows the theme: the Badge');
  t.ok(spinner.includes(`${YELLOW_SGR}${spinners.dots.frames[0]}`), 'and the Spinner');
});

s.fence(F, 0, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const label = fence.code.match(/>([^<]+)<\/Badge>/)[1];
    const color = fence.code.match(/color="(\w+)"/)[1];
    const app = await open(h(mod.App));
    t.equal(app.screen(), ` ${label.toUpperCase()}`, 'the Badge renders as usual under the default theme');
    t.equal(app.bytes(), (await open(h(ui.Badge, { color }, label))).bytes(), 'exactly as it does with no provider at all');
  },
});

// ===================================================================== what a Theme is

const THEME =
  'A `Theme` is `{components: Record<string, ComponentTheme>}` — keyed by component name, each with an optional `styles` map (functions returning style objects, given the component\'s current props/state) and an optional `config` **function** (returns non-style settings, such as the characters a `ProgressBar` draws with — it is a function, not a map).';
s.types(F, [THEME], tsx`
import React from 'react';
import {defaultTheme, ProgressBar, type Theme, type ComponentTheme} from '@inkjs/ui';
${EQ}
export const theme: Equal<Theme, {components: Record<string, ComponentTheme>}> = true;
type Styles = NonNullable<ComponentTheme['styles']>;
export const styles: Equal<ComponentTheme['styles'], Record<string, (props?: any) => Record<string, unknown>> | undefined> = true;
export const config: Equal<ComponentTheme['config'], ((props?: any) => Record<string, unknown>) | undefined> = true;
export const bothOptional: ComponentTheme = {};
export const ok: ComponentTheme = {styles: {text: () => ({color: 'red'})}, config: () => ({completedCharacter: '#'})};
export const configIsNotAMap: ComponentTheme = {config: {completedCharacter: '#'}}; //! TS2353
export const stylesAreFunctions: ComponentTheme = {styles: {text: {color: 'red'}}}; //! TS2353
export const keyed: Theme = {components: {ProgressBar: {config: () => ({})}}};
export const named: Styles | undefined = defaultTheme.components['ProgressBar']?.styles;
export const shown = <ProgressBar value={1} />;
`, { ctx: ['function'] });
s.fact(F, [THEME], { kind: 'R', ctx: ['Theme', '{components: Record<string, ComponentTheme>}', 'function'] }, async (t, q) => {
  const [stylesKey, configKey] = [q.tok('styles'), q.tok('config')];
  const ProgressBar = q.api(ui, 'ProgressBar');
  t.deepEqual(Object.keys(defaultTheme), ['components'], 'a theme is an object with a components map');
  for (const [name, component] of Object.entries(defaultTheme.components)) {
    t.equal(typeof ui[name], 'function', `${name}: keyed by the name of a component the library exports`);
    t.ok(Object.keys(component).every((key) => [stylesKey, configKey].includes(key)), `${name}: only ${stylesKey} and ${configKey}`);
    t.ok(Object.values(component[stylesKey]).every((fn) => typeof fn === 'function'), `${name}: ${stylesKey} is a map of functions`);
    if (configKey in component) t.equal(typeof component[configKey], 'function', `${name}: ${configKey} is a function`);
  }
  t.ok(Object.values(defaultTheme.components).some((component) => !(configKey in component)), `${configKey} is optional`);
  // styles functions return style objects and are given the component's current props/state
  const { theme, calls } = spied(defaultTheme);
  const element = (variant) => h(Box, { flexDirection: 'column' }, h(ui.Badge, { color: 'green' }, 'b'), h(ui.StatusMessage, { variant }, 's'), h(ui.Alert, { variant }, 'a'), h(ui.Select, { options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] }), h(ui.ConfirmInput, { onConfirm() {}, onCancel() {} }));
  render(themed(theme, element('error')));
  const argsOf = (name, key) => calls.find(([component, style]) => component === name && style === key)[2][0];
  t.deepEqual(argsOf('Badge', 'container'), { color: 'green' }, 'Badge: container is given its color');
  t.deepEqual(argsOf('StatusMessage', 'icon'), { variant: 'error' }, 'StatusMessage: icon is given its variant');
  t.deepEqual(argsOf('Alert', 'container'), { variant: 'error' }, 'Alert: container is given its variant');
  t.deepEqual(Object.keys(argsOf('Select', 'option')), ['isFocused'], 'Select: option is given whether it is focused');
  t.deepEqual(Object.keys(argsOf('ConfirmInput', 'input')), ['isFocused'], 'ConfirmInput: input is given whether the input is focused');
  for (const component of Object.values(defaultTheme.components)) {
    for (const [key, fn] of Object.entries(component[stylesKey])) {
      const style = fn({ color: 'green', variant: 'info', isFocused: true, isSelected: true });
      t.ok(style !== null && typeof style === 'object' && !Array.isArray(style), `${key} returns a style object`);
    }
  }
  // config returns non-style settings: the characters a ProgressBar draws with
  const settings = defaultTheme.components.ProgressBar[configKey]();
  t.deepEqual(Object.keys(settings).sort(), ['completedCharacter', 'remainingCharacter'], 'ProgressBar: config returns the characters, not styles');
  const bar = (theme) => stripAnsi(render(themed(theme, h(ProgressBar, { value: 50 })), 10));
  t.equal(bar(defaultTheme), '█████░░░░░');
  const custom = extendTheme(defaultTheme, { components: { ProgressBar: { [configKey]: () => ({ completedCharacter: '#', remainingCharacter: '.' }) } } });
  t.equal(bar(custom), '#####.....', 'and a theme that replaces the config function changes the characters drawn');
  const asMap = extendTheme(defaultTheme, { components: { ProgressBar: { [configKey]: { completedCharacter: '#', remainingCharacter: '.' } } } });
  const broken = catchRenderError(themed(asMap, h(ProgressBar, { value: 50 })));
  t.ok(broken instanceof TypeError && /config is not a function/.test(broken.message), 'while the same settings given as a map instead of a function make the component throw');
});

s.fact(F, ['A theme that leaves a component out makes that component throw, so extend `defaultTheme` instead (below).'], { kind: 'R' }, async (t, q) => {
  const base = q.api(ui, 'defaultTheme');
  const table = scenes(Text);
  const error = (element) => catchRenderError(element);
  for (const name of Object.keys(base.components)) {
    const { element } = table[name];
    const without = { components: Object.fromEntries(Object.entries(base.components).filter(([key]) => key !== name)) };
    const thrown = error(themed(without, element));
    t.ok(thrown instanceof TypeError, `${name}: a theme without it makes it throw`);
    t.equal(error(themed(base, element)), null, `${name}: positive control: with the default theme it renders`);
    t.equal(error(themed(extendTheme(base, { components: { Extra: { styles: {} } } }), element)), null, `${name}: and so does a theme extended from it`);
  }
  t.ok(error(themed({ components: {} }, h(ui.Badge, null, 'x'))) instanceof TypeError, 'an empty theme breaks every component');
});

// ===================================================================== extendTheme

const EXTEND = '`extendTheme(originalTheme, newTheme)` deep-merges a partial theme onto an existing one — a way to tweak a couple of colors without redefining every component\'s full style function:';
s.fact(F, ['`extendTheme` — override just what you need', EXTEND], { kind: 'R' }, async (t, q) => {
  const extend = q.api(ui, 'extendTheme(originalTheme, newTheme)');
  t.equal(ui[q.tok('extendTheme')], extend, 'extendTheme is the function the heading names');
  const params = q.tok('extendTheme(originalTheme, newTheme)').match(/\((.*)\)/)[1].split(', ');
  t.equal(extend.length, params.length, 'it takes the two themes it names');
  const frame = () => ({ color: 'magenta' });
  const before = JSON.stringify(Object.keys(defaultTheme.components.Spinner.styles));
  const merged = extend(defaultTheme, { components: { Spinner: { styles: { frame } } } });
  t.equal(merged.components.Spinner.styles.frame, frame, 'the overridden style function is the new one');
  t.deepEqual(Object.keys(merged.components.Spinner.styles), JSON.parse(before), 'the rest of that component keeps its style keys (a deep merge, not a replacement)');
  t.equal(merged.components.Spinner.styles.container, defaultTheme.components.Spinner.styles.container, 'and its other style functions');
  t.deepEqual(Object.keys(merged.components), Object.keys(defaultTheme.components), 'every other component is kept');
  t.equal(merged.components.Badge.styles.label, defaultTheme.components.Badge.styles.label);
  t.equal(defaultTheme.components.Spinner.styles.frame().color, 'blue', 'the original theme is not modified');
  t.notEqual(merged, defaultTheme, 'a new theme comes back');
  // partial: the new theme need not mention styles, config or most components
  const onlyConfig = extend(defaultTheme, { components: { ProgressBar: { config: () => ({ completedCharacter: '#', remainingCharacter: '.' }) } } });
  t.equal(onlyConfig.components.ProgressBar.styles.completed, defaultTheme.components.ProgressBar.styles.completed, 'a theme with only a config keeps the styles');
  const fresh = extend(defaultTheme, { components: { Banner: { styles: { text: () => ({ bold: true }) } } } });
  t.deepEqual(Object.keys(fresh.components), [...Object.keys(defaultTheme.components), 'Banner'], 'and a component the original does not have is added');
  const colors = (theme) => render(themed(theme, h(ui.Spinner, { label: 'x' })));
  t.ok(colors(merged).includes('\x1b[35m'), 'a couple of colors tweaked this way show up in the output');
  t.ok(colors(defaultTheme).includes('\x1b[34m') && !colors(defaultTheme).includes('\x1b[35m'), 'positive control: the default is blue');
});
s.types(F, [EXTEND], tsx`
import {extendTheme, defaultTheme, type Theme} from '@inkjs/ui';
${EQ}
export const signature: Equal<typeof extendTheme, (originalTheme: Theme, newTheme: Theme) => {components: Record<string, import('@inkjs/ui').ComponentTheme>}> = true;
export const partial = extendTheme(defaultTheme, {components: {Spinner: {styles: {frame: () => ({color: 'magenta'})}}}});
export const none = extendTheme(defaultTheme, {components: {}});
export const noComponents = extendTheme(defaultTheme, {}); //! TS2741
`, { ctx: ['extendTheme(originalTheme, newTheme)'] });

s.fence(F, 1, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const app = await open(h(mod.App));
    t.equal(app.screen(), `${spinners.dots.frames[0]} ${fence.code.match(/label="([^"]+)"/)[1]}`, 'the Spinner draws as usual');
    t.ok(app.bytes().includes(`\x1b[35m${spinners.dots.frames[0]}`), 'with the frame in the color the theme gives it');
    const plain = await open(h(ui.Spinner, { label: 'Loading' }));
    t.ok(plain.bytes().includes('\x1b[34m') && !plain.bytes().includes('\x1b[35m'), 'positive control: without the theme it is blue');
    t.equal(mod.customTheme.components.Spinner.styles.frame().color, 'magenta');
  },
});

// ===================================================================== declarations

s.fact(
  F,
  ["Read each component's shipped declaration, `node_modules/@inkjs/ui/build/components/<name>/theme.d.ts`, for the exact key names and what each style function receives and returns."],
  { kind: 'R' },
  async (t, q) => {
    const template = q.tok('node_modules/@inkjs/ui/build/components/<name>/theme.d.ts');
    for (const [name, component] of Object.entries(defaultTheme.components)) {
      const path = join(ROOT, template.replace('<name>', kebab(name)));
      const declaration = readFileSync(path, 'utf8');
      const block = declaration.match(/styles:\s*\{([\s\S]*?)\n    \};/)[1];
      const declared = [...block.matchAll(/^ {8}(\w+)(?:\(|:)/gm)].map((m) => m[1]);
      t.deepEqual(declared, Object.keys(component.styles), `${name}: the declaration names exactly the style keys the theme has`);
      t.ok(declared.every((key) => new RegExp(`^ {8}${key}(: \\(|\\()`, 'm').test(block)), `${name}: each is declared as a function, with its argument and result types`);
    }
  },
);

const KEYS = "The keys vary per component: `Spinner` has `container` (`BoxProps`), `frame` and `label` (`TextProps`); `Badge` has `container` (given `{color}`) and `label`.";
s.types(F, [KEYS], tsx`
import type {BoxProps, TextProps} from 'ink';
import type {Theme as SpinnerTheme} from '../../../node_modules/@inkjs/ui/build/components/spinner/theme.js';
import type {Theme as BadgeTheme} from '../../../node_modules/@inkjs/ui/build/components/badge/theme.js';
${EQ}
export const spinnerKeys: Equal<keyof SpinnerTheme['styles'], 'container' | 'frame' | 'label'> = true;
export const container: Equal<ReturnType<SpinnerTheme['styles']['container']>, BoxProps> = true;
export const frame: Equal<ReturnType<SpinnerTheme['styles']['frame']>, TextProps> = true;
export const label: Equal<ReturnType<SpinnerTheme['styles']['label']>, TextProps> = true;
export const badgeKeys: Equal<keyof BadgeTheme['styles'], 'container' | 'label'> = true;
export const badgeContainer: Equal<Parameters<BadgeTheme['styles']['container']>[0], Pick<TextProps, 'color'>> = true;
export const badgeLabel: Equal<ReturnType<BadgeTheme['styles']['label']>, TextProps> = true;
`, { ctx: ['{color}'] });
s.fact(F, [KEYS], { kind: 'D' }, async (t, q) => {
  const [Spinner, Badge] = [q.tok('Spinner'), q.tok('Badge')];
  const [container, frame, label] = [q.tok('container'), q.tok('frame'), q.tok('label')];
  const given = q.tok('{color}').slice(1, -1);
  t.deepEqual(Object.keys(defaultTheme.components[Spinner].styles).sort(), [container, frame, label].sort(), 'Spinner has exactly container, frame and label');
  t.deepEqual(Object.keys(defaultTheme.components[Badge].styles).sort(), [container, label].sort(), 'Badge has exactly container and label');
  const types = (name) => readFileSync(join(ROOT, `node_modules/@inkjs/ui/build/components/${kebab(name)}/theme.d.ts`), 'utf8');
  t.match(types(Spinner), new RegExp(`${container}: \\(\\) => ${q.tok('BoxProps')};`), 'container is a BoxProps style');
  t.match(types(Spinner), new RegExp(`${frame}: \\(\\) => ${q.tok('TextProps')};\\s+${label}: \\(\\) => TextProps;`), 'frame and label are TextProps styles');
  const { theme, calls } = spied(defaultTheme);
  render(themed(theme, h(ui.Badge, { color: 'green' }, 'x')));
  const containerCall = calls.find(([name, key]) => name === Badge && key === container);
  t.deepEqual(Object.keys(containerCall[2][0]), [given], 'Badge container is called with an object holding just the color');
  t.equal(containerCall[2][0][given], 'green');
});

// ===================================================================== useComponentTheme

s.fact(F, ["For a custom component built to match `@inkjs/ui`'s look, read the current theme the same way its built-in components do."], { kind: 'R' }, async (t, q) => {
  const uiModule = await import(q.tok('@inkjs/ui'));
  const { theme, calls } = spied(defaultTheme);
  let read;
  const Custom = () => {
    read = uiModule.useComponentTheme('Badge');
    return h(Text, null, 'custom');
  };
  render(themed(theme, h(Box, null, h(uiModule.Badge, null, 'b'), h(Custom))));
  t.equal(read, theme.components.Badge, 'a custom component gets the theme object of the component name it asks for');
  read.styles.label();
  t.equal(calls.filter(([name, key]) => name === 'Badge' && key === 'label').length, 2, 'the same functions the built-in Badge calls (once for itself, once for the custom component)');
});

const SATISFIES = "Define the component's theme with `satisfies ComponentTheme` so its style functions keep their precise types, then register it with `extendTheme`:";
s.types(F, [SATISFIES], tsx`
import React from 'react';
import {Text, type TextProps} from 'ink';
import {defaultTheme, extendTheme, useComponentTheme, type ComponentTheme} from '@inkjs/ui';

const precise = {
	styles: {
		text: (): TextProps => ({color: 'cyan', bold: true}),
	},
} satisfies ComponentTheme;

const widened: ComponentTheme = {
	styles: {
		text: (): TextProps => ({color: 'cyan', bold: true}),
	},
};

export const theme = extendTheme(defaultTheme, {components: {Banner: precise}});

export const Precise = () => {
	const {styles} = useComponentTheme<typeof precise>('Banner');
	return <Text {...styles.text()}>x</Text>;
};

export const Widened = () => {
	const {styles} = useComponentTheme<typeof widened>('Banner');
	return <Text {...styles.text()}>x</Text>; //! TS18048
};
`);
s.fact(F, [SATISFIES], { kind: 'R', ctx: ['satisfies ComponentTheme'] }, async (t, q) => {
  const extend = q.api(ui, 'extendTheme');
  const banner = { styles: { text: () => ({ color: 'cyan', bold: true }) } };
  const theme = extend(defaultTheme, { components: { Banner: banner } });
  t.ok('Banner' in theme.components, 'the custom component is registered under its name');
  t.equal(theme.components.Banner.styles.text, banner.styles.text, 'with its own style functions');
  let read;
  const Banner = () => {
    read = ui.useComponentTheme('Banner');
    return h(Text, read.styles.text(), 'Hello');
  };
  const out = render(themed(theme, h(Banner)));
  t.ok(out.includes('\x1b[36m') && out.includes('\x1b[1m'), 'and the component reads it back and is styled by it');
  t.equal(read, theme.components.Banner);
});

s.fence(F, 2, {
  run: async (t, fence) => {
    const { mod, apps } = await runFence(fence);
    await apps[0].flush();
    const text = fence.code.match(/<Banner>([^<]+)<\/Banner>/)[1];
    t.equal(apps[0].screen(), text, 'the banner text is drawn');
    t.ok(apps[0].bytes().includes('\x1b[36m') && apps[0].bytes().includes('\x1b[1m'), 'in the registered style: cyan and bold');
    t.equal(mod.theme.components.Banner.styles.text().bold, true);
  },
});

const HOOK = '`useComponentTheme` just returns `theme.components[name]`: for a name that isn\'t in the active theme it returns `undefined`, and destructuring that throws — so register every custom component in the theme you pass to `ThemeProvider`.';
s.fact(F, [HOOK], { kind: 'R' }, async (t, q) => {
  const useTheme = q.api(ui, 'useComponentTheme');
  const Provider = q.api(ui, 'ThemeProvider');
  const [object, key] = q.tok('theme.components[name]').match(/^theme\.(\w+)\[(\w+)\]$/).slice(1);
  const theme = extendTheme(defaultTheme, { components: { Banner: { styles: { text: () => ({}) } } } });
  const read = (name) => {
    let value = 'unset';
    render(h(Provider, { theme }, h(() => ((value = useTheme(name)), h(Text, null, 'p')))));
    return value;
  };
  for (const name of ['Banner', 'Badge', 'Spinner']) t.equal(read(name), theme[object][name], `${name}: what is stored in ${object} under its ${key}`);
  t.equal(read('Missing'), theme[object].Missing, 'a name that is not in the theme gives what the lookup gives');
  t.equal(typeof read('Missing'), q.tok('undefined'), 'which is undefined');
  const destructure = (name) => catchRenderError(h(Provider, { theme }, h(() => (({ styles }) => h(Text, null, String(styles)))(useTheme(name)))));
  t.equal(destructure('Banner'), null, 'positive control: a registered component can be destructured');
  const thrown = catchRenderError(h(Provider, { theme }, h(() => { const { styles } = useTheme('Missing'); return h(Text, null, String(styles)); })));
  t.ok(thrown instanceof TypeError && /destructure/.test(thrown.message), 'destructuring the undefined throws a TypeError');
  const without = { components: { Badge: defaultTheme.components.Badge } };
  t.ok(catchRenderError(h(Provider, { theme: without }, h(() => { const { styles } = useTheme('Banner'); return h(Text, null, String(styles)); }))) instanceof TypeError, 'so a custom component missing from the theme given to the provider fails');
});

s.fact(F, ['(Without any `ThemeProvider` the context defaults to `defaultTheme`, so built-in components need no provider to look normal.)'], { kind: 'R' }, async (t, q) => {
  const Provider = q.api(ui, 'ThemeProvider');
  const dflt = q.api(ui, 'defaultTheme');
  let seen;
  render(h(() => ((seen = React.useContext(ThemeContext)), h(Text, null, 'p'))));
  t.equal(seen, dflt, 'with no provider the context holds the default theme');
  const table = scenes(Text);
  for (const [name, { element }] of Object.entries(table)) {
    t.equal(render(h(Provider, { theme: dflt }, element)), render(element), `${name}: looks the same with no provider as inside one holding the default theme`);
  }
  t.ok(render(h(ui.Badge, { color: 'green' }, 'x')).includes('\x1b[42m'), 'and is styled, not bare');
});

// ===================================================================== nesting

const NESTED = '`ThemeProvider` is a plain context provider, so a nested one **replaces** the theme above it for its own subtree — it does not merge with it.';
s.fact(F, [NESTED], { kind: 'R', ctx: ['replaces'] }, async (t, q) => {
  const Provider = q.api(ui, 'ThemeProvider');
  const theme = override('Badge', 'label', YELLOW);
  const element = Provider({ theme, children: null });
  t.equal(element.type, ThemeContext.Provider, 'it is nothing more than the context provider of the shared theme');
  t.equal(element.props.value, theme, 'holding the theme it is given');
  const badge = h(ui.Badge, null, 'x');
  const outer = override('Badge', 'label', YELLOW);
  const inside = (inner) => render(h(Provider, { theme: outer }, h(Box, { flexDirection: 'column' }, badge, h(Provider, { theme: inner }, badge)))).split('\n');
  const [above, below] = inside(defaultTheme);
  t.ok(above.includes(`${YELLOW_SGR}X`), 'the outer theme applies above');
  t.ok(!below.includes(YELLOW_SGR), 'the nested provider replaces it: its subtree no longer has the outer override');
  const missing = catchRenderError(h(Provider, { theme: outer }, h(Provider, { theme: { components: { Spinner: defaultTheme.components.Spinner } } }, badge)));
  t.ok(missing instanceof TypeError, 'and it is not merged with it: what the inner theme lacks is not taken from the outer one either');
});

s.fact(F, ['Build the inner theme with `extendTheme(outerTheme, …)` to keep the outer overrides.'], { kind: 'R' }, async (t, q) => {
  const extend = q.api(ui, 'extendTheme(outerTheme, …)');
  const outer = override('Badge', 'label', YELLOW);
  const inner = extend(outer, { components: { Spinner: { styles: { frame: () => ({ color: 'magenta' }) } } } });
  const tree = h(ThemeProvider, { theme: outer }, h(ThemeProvider, { theme: inner }, h(Box, { flexDirection: 'column' }, h(ui.Badge, null, 'x'), h(ui.Spinner, { label: 's' }))));
  const [badge, spinner] = render(tree).split('\n');
  t.ok(badge.includes(`${YELLOW_SGR}X`), 'the nested subtree keeps the outer override');
  t.ok(spinner.includes('\x1b[35m'), 'and has its own');
  const plainInner = render(h(ThemeProvider, { theme: outer }, h(ThemeProvider, { theme: defaultTheme }, h(ui.Badge, null, 'x'))));
  t.ok(!plainInner.includes(YELLOW_SGR), 'positive control: an inner theme not built from the outer one loses the override');
});

s.fact(
  F,
  ['Useful for a single section of the UI (e.g. a "danger zone") that should render with different component colors than the rest of the app.'],
  { kind: 'R', ctx: ['danger zone'] },
  async (t) => {
    const danger = override('Badge', 'container', { backgroundColor: 'red' });
    const badge = (label) => h(ui.Badge, { color: 'green' }, label);
    const out = render(h(ThemeProvider, { theme: defaultTheme }, h(Box, { flexDirection: 'column' }, badge('app'), h(ThemeProvider, { theme: danger }, badge('danger')), badge('app again')))).split('\n');
    t.ok(out[0].startsWith('\x1b[42m') && out[2].startsWith('\x1b[42m'), 'the rest of the app keeps its colors');
    t.ok(out[1].startsWith('\x1b[41m'), 'while the section inside the nested provider renders with the colors it was given');
  },
);
