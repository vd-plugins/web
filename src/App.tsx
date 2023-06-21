import Fuse from "fuse.js";
import { For, Match, Switch, createEffect, createResource, createSignal, onMount, type Component } from "solid-js";

import styles from "./App.module.css";

interface Author {
  name: string;
  id?: string;
}

interface PluginManifest {
  name: string;
  description: string;
  authors: Author[];
  main: string;
  hash: string;
  vendetta?: {
    icon?: string;
    original: string;
  };
  url: string;
}

const base = "https://vd-plugins.github.io/proxy/plugins-full.json";

const getPlugins = () =>
  fetch(base)
    .then((r) => r.json())
    .then((plugins) =>
      plugins.reverse().map((p: any) => ({
        ...p,
        url: new URL(p.vendetta.original, base).href,
      })),
    );

const fuzzy = <T extends unknown[]>(set: T, search: string) =>
  !search
    ? set
    : (new Fuse(set, {
        threshold: 0.3,
        useExtendedSearch: true,
        keys: ["name", ["authors", "name"]],
      })
        .search(search)
        .map((searchResult) => searchResult.item) as T);

const debounce = (fn: (...args: any[]) => any, ms = 1000) => {
  let timeoutId: number;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

async function copyText(str: string) {
  try {
   await navigator.clipboard.writeText(str);
  } catch {
    const copyArea = document.createElement("textarea");

    // Try our best to hide the element, visibility: hidden makes it break on some browsers.
    copyArea.style.width = '0';
    copyArea.style.height = '0';
    copyArea.style.position = "absolute";
    copyArea.style.top = `${window.pageYOffset || document.documentElement.scrollTop}px`;
    copyArea.style.left = "-9999px";

    copyArea.setAttribute("readonly", "");
    copyArea.value = str;

    document.body.appendChild(copyArea);
    copyArea.focus();
    copyArea.select();

    document.execCommand("copy");
    document.body.removeChild(copyArea);
  }
}

const PluginCard: Component<{ manifest: PluginManifest }> = (props) => {
  return (
    <div class={styles.card}>
      <div class={styles.title}>{props.manifest.name}</div>
      <div class={styles.desc}>{props.manifest.description}</div>
      <div class={styles.bottom}>
        <div class={styles.authors}>{props.manifest.authors.map((a: Author) => a.name).join(", ")}</div>
        <button onClick={() => copyText(props.manifest.url)} class={styles.btn}>
          Copy link
        </button>
      </div>
    </div>
  );
};

const App: Component = () => {
  const [data] = createResource<PluginManifest[]>(getPlugins);
  const [search, setSearch] = createSignal(decodeURIComponent(location.hash.slice(1)));

  const updateHash = debounce(() => history.replaceState(undefined, "", `#${encodeURIComponent(search())}`));
  createEffect(() => (search(), updateHash()));

  let input: HTMLInputElement | undefined;
  onMount(() => {
    input?.focus();
  });

  const results = () => fuzzy(data() ?? [], search());

  return (
    <div>
      <h1 class={styles.header}>Vendetta plugins</h1>
      <div class={styles.search}>
        <input
          placeholder="Search..."
          class={styles.input}
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          ref={input}
        />
      </div>
      <div class={styles.list}>
        <Switch fallback={<div>Loading...</div>}>
          <Match when={data.state === "errored"}>
            <div>Could not fetch plugins</div>
          </Match>
          <Match when={data.state === "ready"}>
            <For each={results()}>{(manifest) => <PluginCard manifest={manifest} />}</For>
          </Match>
        </Switch>
      </div>
    </div>
  );
};

export default App;
