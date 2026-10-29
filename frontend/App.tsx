import { t } from "./lib/messages";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "./lib/api";
import type { Area, Language } from "./lib/types";
import { say } from "./lib/types";
import {
  galleryIdFromHash,
  galleryLesson,
  galleryShow,
  showIdFromHash,
} from "./lib/shared";
import { Brand } from "./components/Brand";
import { Studio } from "./components/Studio";
import { AccessPanel } from "./components/AccessPanel";
import { useInstallPrompt } from "./lib/install";
const Labs = lazy(() =>
  import("./components/labs/Labs").then((module) => ({
    default: module.Labs,
  })),
);

const ShowPlayer = lazy(() =>
  import("./components/ShowPlayer").then((module) => ({
    default: module.ShowPlayer,
  })),
);
// Busy flags from the areas are not used by the shell yet; the areas keep their own.
const noop = () => {};
function readRoute() {
  const hash = location.hash;
  return {
    area: (["#physics", "#quantum", "#create"].includes(hash)
      ? hash.slice(1)
      : "studio") as Area,
    lessonId: galleryIdFromHash(hash) as string | null,
    showId: showIdFromHash(hash) as string | null,
  };
}
export function App() {
  const auth = useAuth();
  const { loading: authLoading, info: authInfo, login: authLogin } = auth;
  const [language, setLanguage] = useState<Language>(() => {
      try {
        return localStorage.getItem("explainback-language") === "zh"
          ? "zh"
          : "en";
      } catch {
        return "en";
      }
    }),
    [route, setRoute] = useState(readRoute),
    [showAccess, setShowAccess] = useState(false),
    [starter, setStarter] = useState(0),
    [libraryVisit, setLibraryVisit] = useState(0);
  const invite = useRef<string | null>(null),
    firstAuth = useRef(false),
    main = useRef<HTMLElement>(null),
    accessRef = useRef<HTMLDivElement>(null);
  const setLang = useCallback((value: Language) => setLanguage(value), []);
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    try {
      localStorage.setItem("explainback-language", language);
    } catch {}
  }, [language]);
  // The tab title names the open gallery lesson or show, so shares and history read well.
  useEffect(() => {
    const item = galleryLesson(route.lessonId ?? route.showId ?? "");
    document.title = item
      ? `${item.lesson.title[language]} · ExplainBack`
      : t(language, "App.explainbackLearnByExplaining");
  }, [language, route.lessonId, route.showId]);
  const installer = useInstallPrompt();
  useEffect(() => {
    const update = () => {
      const code = /^#invite:([A-Za-z0-9-]{8,64})$/.exec(location.hash)?.[1];
      if (code) {
        invite.current = code;
        history.replaceState(null, "", "#create");
      }
      setRoute(readRoute());
    };
    update();
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  // Each `#invite:` navigation is applied once (the ref is cleared on use), so the same
  // link signs in again after a sign-out in the same tab, without a reload.
  useEffect(() => {
    if (authLoading) return;
    const code = invite.current;
    if (!code) return;
    invite.current = null;
    if (authInfo.authenticated) {
      setStarter((n) => n + 1);
      return;
    }
    if (authInfo.codes)
      void authLogin({ code }).then((ok) => {
        if (ok) {
          setStarter((n) => n + 1);
          setShowAccess(false);
        } else setShowAccess(true);
      });
    else setShowAccess(true);
  }, [authLoading, authInfo.authenticated, authInfo.codes, authLogin, route]);
  useEffect(() => {
    if (auth.info.authenticated) {
      firstAuth.current = true;
      setShowAccess(false);
    } else if (firstAuth.current) {
      setRoute({ area: "studio", lessonId: null, showId: null });
      history.replaceState(null, "", "#studio");
      firstAuth.current = false;
    }
  }, [auth.info.authenticated]);
  const openAccess = useCallback(() => {
    setShowAccess(true);
    setTimeout(() => accessRef.current?.querySelector("input")?.focus(), 0);
  }, []);
  const login = async (body: unknown) => {
    const ok = await auth.login(body);
    if (ok) {
      setShowAccess(false);
      setRoute({ area: "create", lessonId: null, showId: null });
      history.replaceState(null, "", "#create");
      setStarter((n) => n + 1);
    }
    return ok;
  };
  const [visited, setVisited] = useState({ physics: false, quantum: false });
  useEffect(() => {
    if (!auth.info.authenticated) {
      setVisited({ physics: false, quantum: false });
      return;
    }
    if (route.area === "physics" || route.area === "quantum")
      setVisited((previous) => ({ ...previous, [route.area]: true }));
  }, [auth.info.authenticated, route.area]);
  const focusRoute = useRef(
    `${route.area}/${route.lessonId}/${route.showId}/${libraryVisit}`,
  );
  useEffect(() => {
    const key = `${route.area}/${route.lessonId}/${route.showId}/${libraryVisit}`;
    if (key === focusRoute.current) return;
    focusRoute.current = key;
    main.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route.area, route.lessonId, route.showId, libraryVisit]);
  const area = route.area;
  const galleryShowItem = route.showId
    ? { lesson: galleryLesson(route.showId), show: galleryShow(route.showId) }
    : null;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t(language, "App.skipToContent")}
      </a>
      <header className="site-header">
        <a
          href="#studio"
          onClick={() => setLibraryVisit((n) => n + 1)}
          className="brand-link"
          aria-label="ExplainBack home"
        >
          <Brand />
        </a>
        <nav
          aria-label={t(language, "App.mainNavigation")}
          className="main-nav"
        >
          <a
            href="#studio"
            onClick={() => setLibraryVisit((n) => n + 1)}
            aria-current={area === "studio" ? "page" : undefined}
          >
            {t(language, "App.explore")}
          </a>
          <a
            href="#create"
            onClick={() => setLibraryVisit((n) => n + 1)}
            aria-current={area === "create" ? "page" : undefined}
          >
            {t(language, "App.create")}
          </a>
          {auth.info.authenticated && (
            <>
              <a
                href="#physics"
                aria-current={area === "physics" ? "page" : undefined}
              >
                {t(language, "App.physics")}
              </a>
              <a
                href="#quantum"
                aria-current={area === "quantum" ? "page" : undefined}
              >
                {t(language, "App.quantum")}
              </a>
            </>
          )}
        </nav>
        <div className="header-tools">
          <label className="language-switch">
            <span className="sr-only">Language / 语言</span>
            <select
              value={language}
              onChange={(event) => setLang(event.target.value as Language)}
              aria-label="Language / 语言"
            >
              <option value="en">EN · English</option>
              <option value="zh">中 · 中文</option>
            </select>
          </label>
          {installer.canInstall && (
            <button className="text-button" onClick={installer.install}>
              {t(language, "App.installApp")}
            </button>
          )}
          {auth.info.authenticated && !auth.info.open ? (
            <button
              className="text-button"
              disabled={auth.working}
              onClick={() => void auth.logout()}
            >
              {t(language, "App.signOut")}
            </button>
          ) : (
            !auth.info.authenticated && (
              <button
                className="text-button"
                onClick={openAccess}
                disabled={auth.loading}
              >
                {t(language, "App.previewAccess")}
              </button>
            )
          )}
        </div>
      </header>
      {auth.info.authenticated && (auth.status?.access || auth.info.open) && (
        <div className="access-strip" role="status">
          {auth.info.open
            ? t(language, "App.localDevelopmentOpenAccess")
            : `${auth.status?.access?.label} · ${auth.status?.access?.remaining}/${auth.status?.access?.quota} ${t(language, "App.liveRequestsLeftThisHour")}`}
          {auth.status?.access?.expiresAt && (
            <span>
              {" "}
              · {t(language, "App.expires")}{" "}
              {new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
                dateStyle: "medium",
              }).format(auth.status.access.expiresAt)}
            </span>
          )}
        </div>
      )}
      <main id="main-content" ref={main} tabIndex={-1}>
        {auth.loading && (
          <p className="connection-note" role="status">
            {t(language, "App.openingYourLearningStudio")}
          </p>
        )}
        {galleryShowItem?.lesson && galleryShowItem.show && (
          <Suspense fallback={<p role="status">…</p>}>
            <ShowPlayer
              key={`show-${route.showId}`}
              lesson={galleryShowItem.lesson.lesson}
              show={galleryShowItem.show.show}
              cover={galleryShowItem.show.cover}
              language={language}
              scriptModel={galleryShowItem.show.model}
              coverModel={galleryShowItem.show.coverModel}
              onClose={() => {
                location.hash = `#lesson:${route.showId}`;
              }}
            />
          </Suspense>
        )}
        <Studio
          key={auth.identity}
          language={language}
          authenticated={auth.info.authenticated}
          status={auth.status}
          post={auth.post}
          visible={
            !route.lessonId &&
            !route.showId &&
            (area === "studio" || area === "create")
          }
          view={area === "create" ? "create" : "studio"}
          lessonId={null}
          starter={starter}
          onBusy={noop}
          onRequestAccess={openAccess}
        />
        {route.lessonId && (
          <Studio
            key={`gallery-${auth.identity}-${route.lessonId}`}
            language={language}
            authenticated={auth.info.authenticated}
            status={auth.status}
            post={auth.post}
            visible={area === "studio"}
            view="studio"
            lessonId={route.lessonId}
            starter={0}
            onBusy={noop}
            onRequestAccess={openAccess}
          />
        )}
        {auth.info.authenticated && auth.status && (
          <Suspense
            fallback={
              <p role="status">
                {t(language, "App.openingTheExperimentBench")}
              </p>
            }
          >
            {visited.physics && (
              <Labs
                key={`physics-${auth.identity}`}
                kind="physics"
                language={language}
                visible={area === "physics"}
                status={auth.status}
                post={auth.post}
                onBusy={noop}
                onLanguage={setLang}
              />
            )}
            {visited.quantum && (
              <Labs
                key={`quantum-${auth.identity}`}
                kind="quantum"
                language={language}
                visible={area === "quantum"}
                status={auth.status}
                post={auth.post}
                onBusy={noop}
                onLanguage={setLang}
              />
            )}
          </Suspense>
        )}
        {!auth.loading &&
          !auth.info.authenticated &&
          (area === "physics" || area === "quantum") && (
            <section className="creation-locked">
              <h1>{t(language, "App.openTheExperimentBench")}</h1>
              <p>{t(language, "App.theseGuidedLabsNeedPreview")}</p>
              <button onClick={openAccess}>
                {t(language, "App.previewAccess")}
              </button>
              <a href="#studio">{t(language, "App.exploreLessons")}</a>
            </section>
          )}
        {showAccess && (
          <div ref={accessRef}>
            <AccessPanel
              language={language}
              info={auth.info}
              working={auth.working}
              error={auth.error}
              onLogin={login}
              onClose={() => setShowAccess(false)}
            />
          </div>
        )}
        {auth.error && !showAccess && (
          <p className="notice" role="status">
            {say(
              language,
              auth.error === "TESTER_REQUIRED"
                ? "Your session ended. Reviewed lessons remain available."
                : "Connection needs attention. The learning library is still available.",
              auth.error === "TESTER_REQUIRED"
                ? "会话已结束，经审阅的课程仍可使用。"
                : "连接需要检查，互动课程库仍可使用。",
            )}{" "}
            <button className="text-button" onClick={openAccess}>
              {t(language, "App.signIn")}
            </button>
          </p>
        )}
      </main>
      <footer className="site-footer">
        <Brand compact />
        <p>{t(language, "App.aLittleCuriosityAClearer")}</p>
        <span>
          {t(language, "App.independentLearningPrototype")}
          <br />
          {t(language, "App.syntheticExamplesTemporarySessions")}
        </span>
      </footer>
    </div>
  );
}
