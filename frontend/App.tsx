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
  comparisonIdFromHash,
} from "./lib/shared";
import { Comparison } from "./components/Comparison";
import { EvaluationPage } from "./components/EvaluationPage";
import { About } from "./components/About";
import { PageHeader } from "./components/PageHeader";
import { EVALUATION_CARD_HASH, REPO_URL } from "./lib/evaluation";
import { Brand } from "./components/Brand";
import { Studio } from "./components/Studio";
import { AccessPanel } from "./components/AccessPanel";
import { BackToTop } from "./components/BackToTop";
import { useInstallPrompt } from "./lib/install";
import { editIdFromHash, readShared, sharedIdFromHash } from "./lib/library";
import type { SavedLesson } from "./lib/library";
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
  // "#show:<id>/play" opens the show and starts narrating at once.
  const play = hash.endsWith("/play");
  const showHash = play ? hash.slice(0, -"/play".length) : hash;
  return {
    showAutoplay: play && showIdFromHash(showHash) !== null,
    area: (["#physics", "#quantum", "#create"].includes(hash)
      ? hash.slice(1)
      : editIdFromHash(hash)
        ? "create"
        : "studio") as Area,
    lessonId: galleryIdFromHash(hash) as string | null,
    showId: showIdFromHash(showHash) as string | null,
    sharedId: sharedIdFromHash(hash),
    compareId: comparisonIdFromHash(hash),
    evaluation: hash === "#evaluation",
    about: hash === "#about",
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
    [libraryVisit, setLibraryVisit] = useState(0),
    // The phone header folds the navigation and tools behind one Menu button.
    [menuOpen, setMenuOpen] = useState(false);
  const invite = useRef<string | null>(null),
    firstAuth = useRef(false),
    main = useRef<HTMLElement>(null),
    accessRef = useRef<HTMLDivElement>(null);
  const setLang = useCallback((value: Language) => setLanguage(value), []);
  // A shared lesson is fetched by its link; it needs no sign-in and makes no model request.
  const [shared, setShared] = useState<{
    id: string;
    record: SavedLesson | null;
    failed: boolean;
  } | null>(null);
  useEffect(() => {
    const id = route.sharedId;
    if (!id) {
      setShared(null);
      return;
    }
    let live = true;
    setShared({ id, record: null, failed: false });
    void readShared(id)
      .then((record) => {
        if (live) setShared({ id, record, failed: false });
      })
      .catch(() => {
        if (live) setShared({ id, record: null, failed: true });
      });
    return () => {
      live = false;
    };
  }, [route.sharedId]);
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    try {
      localStorage.setItem("explainback-language", language);
    } catch {}
  }, [language]);
  // The tab title names the open gallery lesson or show, so shares and history read well.
  useEffect(() => {
    const item = galleryLesson(route.lessonId ?? route.showId ?? "");
    const title =
      item?.lesson.title[language] ?? shared?.record?.title[language];
    document.title = title
      ? `${title} · ExplainBack`
      : t(language, "App.explainbackLearnByExplaining");
  }, [language, route.lessonId, route.showId, shared]);
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
      setRoute({
        area: "studio",
        lessonId: null,
        showId: null,
        sharedId: null,
        compareId: null,
        evaluation: false,
        about: false,
        showAutoplay: false,
      });
      history.replaceState(null, "", "#studio");
      firstAuth.current = false;
    }
  }, [auth.info.authenticated]);
  // Sign in: show the access panel (it sits at the end of the page), fold the phone menu,
  // then bring the panel into view and focus the code field. Phones do not scroll to a
  // field focused after the tap, so the scroll is explicit and the focus skips its own.
  const openAccess = useCallback(() => {
    setShowAccess(true);
    setMenuOpen(false);
    setTimeout(() => {
      const panel = accessRef.current;
      panel?.scrollIntoView?.({ block: "start" });
      panel?.querySelector("input")?.focus({ preventScroll: true });
    }, 0);
  }, []);
  const login = async (body: unknown) => {
    const ok = await auth.login(body);
    if (ok) {
      setShowAccess(false);
      setRoute({
        area: "create",
        lessonId: null,
        showId: null,
        sharedId: null,
        compareId: null,
        evaluation: false,
        about: false,
        showAutoplay: false,
      });
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
    `${route.area}/${route.lessonId}/${route.showId}/${route.sharedId}/${route.compareId}/${route.evaluation}/${route.about}/${libraryVisit}`,
  );
  useEffect(() => {
    const key = `${route.area}/${route.lessonId}/${route.showId}/${route.sharedId}/${route.compareId}/${route.evaluation}/${route.about}/${libraryVisit}`;
    if (key === focusRoute.current) return;
    focusRoute.current = key;
    main.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [
    route.area,
    route.lessonId,
    route.showId,
    route.sharedId,
    route.compareId,
    route.evaluation,
    route.about,
    libraryVisit,
  ]);
  const area = route.area;
  useEffect(() => {
    setMenuOpen(false);
  }, [
    area,
    route.lessonId,
    route.showId,
    route.sharedId,
    route.compareId,
    route.evaluation,
    route.about,
  ]);
  const galleryShowItem = route.showId
    ? { lesson: galleryLesson(route.showId), show: galleryShow(route.showId) }
    : null;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t(language, "App.skipToContent")}
      </a>
      <header className="site-header" data-menu={menuOpen ? "open" : "closed"}>
        <a
          href="#studio"
          onClick={() => setLibraryVisit((n) => n + 1)}
          className="brand-link"
          title={t(language, "App.home")}
        >
          <Brand />
        </a>
        {auth.info.open && (
          <span className="dev-badge">
            {t(language, "App.localDevelopmentOpenAccess")}
          </span>
        )}
        <button
          type="button"
          className="menu-button"
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="menu-icon" aria-hidden="true" />
          {t(language, menuOpen ? "App.closeMenu" : "App.menu")}
        </button>
        <div className="site-menu" id="site-menu">
          <nav
            aria-label={t(language, "App.mainNavigation")}
            className="main-nav"
          >
            <a
              href="#studio"
              onClick={() => setLibraryVisit((n) => n + 1)}
              aria-current={
                area === "studio" && !route.about ? "page" : undefined
              }
            >
              {t(language, "App.library")}
            </a>
            <a
              href="#create"
              onClick={() => setLibraryVisit((n) => n + 1)}
              aria-current={area === "create" ? "page" : undefined}
            >
              {t(language, "App.create")}
            </a>
            <a href="#about" aria-current={route.about ? "page" : undefined}>
              {t(language, "App.about")}
            </a>
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
              <>
                {auth.status?.access && (
                  <span
                    className="account-pill"
                    role="status"
                    title={
                      auth.status.access.expiresAt
                        ? `${auth.status.access.label} · ${t(language, "App.expires")} ${new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium" }).format(auth.status.access.expiresAt)}`
                        : auth.status.access.label
                    }
                  >
                    {auth.status.access.remaining}/{auth.status.access.quota}{" "}
                    {t(language, "App.liveRequestsLeftThisHour")}
                  </span>
                )}
                <button
                  className="text-button"
                  disabled={auth.working}
                  onClick={() => void auth.logout()}
                >
                  {t(language, "App.signOut")}
                </button>
              </>
            ) : (
              !auth.info.authenticated && (
                <button
                  className="account-button"
                  onClick={openAccess}
                  disabled={auth.loading}
                >
                  {t(language, "App.signIn")}
                </button>
              )
            )}
          </div>
        </div>
      </header>
      <main id="main-content" ref={main} tabIndex={-1}>
        {auth.loading && (
          <p className="connection-note" role="status">
            {t(language, "App.openingYourLearningStudio")}
          </p>
        )}
        {galleryShowItem?.lesson && galleryShowItem.show && (
          <section className="show-page">
            <PageHeader
              language={language}
              crumbs={[
                { label: t(language, "App.library"), href: "#studio" },
                { label: galleryShowItem.lesson.lesson.title[language] },
              ]}
              eyebrow={t(language, "ShowPlayer.lessonShow2")}
              title={galleryShowItem.lesson.lesson.title[language]}
              meta={galleryShowItem.lesson.lesson.intro[language]}
              actions={
                <a className="text-link" href={`#lesson:${route.showId}`}>
                  {t(language, "Gallery.openLesson")}
                </a>
              }
            />
            <Suspense fallback={<p role="status">…</p>}>
              <ShowPlayer
                key={`show-${route.showId}`}
                lesson={galleryShowItem.lesson.lesson}
                show={galleryShowItem.show.show}
                cover={galleryShowItem.show.cover}
                illustrations={galleryShowItem.show.illustrations ?? null}
                language={language}
                scriptModel={galleryShowItem.show.model}
                coverModel={galleryShowItem.show.coverModel}
                autoplay={route.showAutoplay}
                titleShown
                onClose={() => {
                  location.hash = `#lesson:${route.showId}`;
                }}
              />
            </Suspense>
          </section>
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
            !route.sharedId &&
            !route.compareId &&
            !route.evaluation &&
            !route.about &&
            (area === "studio" || area === "create")
          }
          view={area === "create" ? "create" : "studio"}
          editId={area === "create" ? editIdFromHash(location.hash) : null}
          lessonId={null}
          starter={starter}
          onBusy={noop}
          onRequestSettled={() => void auth.refresh()}
          onRequestAccess={openAccess}
        />
        {route.compareId && (
          <Comparison
            key={`compare-${route.compareId}`}
            caseId={route.compareId}
            language={language}
          />
        )}
        {route.evaluation && <EvaluationPage language={language} />}
        {route.about && <About language={language} />}
        {route.sharedId && shared?.record && (
          <Studio
            key={`shared-${auth.identity}-${route.sharedId}`}
            language={language}
            authenticated={auth.info.authenticated}
            status={auth.status}
            post={auth.post}
            visible={area === "studio"}
            view="studio"
            lessonId={`shared:${route.sharedId}`}
            external={shared.record}
            starter={0}
            onBusy={noop}
            onRequestAccess={openAccess}
          />
        )}
        {route.sharedId && shared?.failed && (
          <section className="creation-locked">
            <p>{t(language, "Library.sharedUnavailable")}</p>
            <a href="#studio">{t(language, "App.exploreLessons")}</a>
          </section>
        )}
        {route.sharedId && shared && !shared.record && !shared.failed && (
          <p role="status">{t(language, "Studio.loading")}</p>
        )}
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
            <section className="lab-workspace bench-locked">
              <PageHeader
                language={language}
                crumbs={[
                  { label: t(language, "App.library"), href: "#studio" },
                  {
                    label: t(
                      language,
                      area === "physics"
                        ? "App.physicsBench"
                        : "App.quantumBench",
                    ),
                  },
                ]}
                eyebrow={t(language, "Labs.theExperimentBench")}
                title={t(
                  language,
                  area === "physics" ? "App.physicsBench" : "App.quantumBench",
                )}
                meta={t(language, "Labs.coachedMeta")}
              />
              <div className="locked-stage">
                <p className="eyebrow">
                  {t(language, "App.lockedStageEyebrow")}
                </p>
                <h2>{t(language, "App.lockedStageTitle")}</h2>
                <p>
                  {t(language, "App.theseGuidedLabsNeedPreview")}{" "}
                  {t(language, "App.lessonVersionNote")}
                </p>
                <div className="locked-actions">
                  <button onClick={openAccess}>
                    {t(language, "Studio.enterWithAccessCode")}
                  </button>
                  <a
                    className="text-link"
                    href={
                      area === "physics" ? "#lesson:vehicle" : "#lesson:quantum"
                    }
                  >
                    {t(language, "App.openTheLessonVersion")}
                  </a>
                </div>
              </div>
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
      <BackToTop language={language} target={main} />
      <footer className="site-footer">
        <div className="footer-brand">
          <Brand compact />
          <p>{t(language, "App.aLittleCuriosityAClearer")}</p>
        </div>
        <nav aria-label={t(language, "App.about")} className="footer-links">
          <a href="#about">{t(language, "App.about")}</a>
          <a href={EVALUATION_CARD_HASH}>
            {t(language, "Gallery.evaluationCard")}
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            {t(language, "App.sourceOnGitHub")}
          </a>
        </nav>
        <span>
          {t(language, "App.independentLearningPrototype")}
          <br />
          {t(language, "App.syntheticExamplesTemporarySessions")}
        </span>
      </footer>
    </div>
  );
}
