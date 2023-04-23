/*
engine.js
--------
pretend to be the bedrock engine for oreUI's sake
(C) Luminoso 2022 / MIT Licensed
*/


const colorDebug = "#fc03d7";
const colorInfo = "#03fcb1";
const colorWarn = "#fc7703";
const colorError = "#fc0339";

function debugMessage(name, color, ...data) {
  console.log(`[%cEngineWrapper%c] %c%s`, "color: #0398fc;", "color: initial;", `color: ${color};`, name, ...data);
}

if (navigator.userAgent.match("/cohtml/i")) {
  debugMessage("Loader", colorWarn, "OreUI Shim Injected, but the UI is being loaded in gameface!");
}

const USE_TRANSLATIONS = true; //requires a loc.lang at base of host dir

let _ME_OnBindings = {};

const onGlobalListenerRemoval = (() => {
  const callbacks = new Set();
  const eventName = "listenerStillAttached";

  window.addEventListener(eventName, _handleListenerStillAttached);

  new MutationObserver((entries) => {
    const documentReplaced = entries.some(entry =>
      Array.from(entry.addedNodes).includes(document.documentElement)
    );
    if (documentReplaced) {
      const timeoutId = setTimeout(_handleListenerDetached);
      window.dispatchEvent(new CustomEvent(eventName, {detail: timeoutId}));
    }
  }).observe(document, { childList: true });

  function _handleListenerDetached() {
    // reattach event listener
    window.addEventListener(eventName, _handleListenerStillAttached);
    // run registered callbacks
    callbacks.forEach((callback) => callback());
  }

  function _handleListenerStillAttached(event) {
    clearTimeout(event.detail);
  }

  return  {
    addListener: c => void callbacks.add(c),
    hasListener: c =>  callbacks.has(c),
    removeListener: c => callbacks.delete(c)
  }
})();


class Facet {
  update() {
    const func = engine.bindings[`facet:updated:${this.facetName}`];
    if(func) func(this);
  }
  error() {
    const func = engine.bindings[`facet:error:${this.facetName}`];
    if(func) func(this);
  }
}


//#region core



const _ME_Platforms = {
  IOS: 0,
  GOOGLE: 1,
  AMAZON_HANDHELD: 2,
  UWP: 3,
  XBOX: 4,
  NX_HANDHELD: 5,
  PS4: 6,
  GEARVR: 7,
  WIN32: 8,
  MACOS: 9,
  AMAZON_TV: 10,
  NX_TV: 11,
  PS5: 12,
};

class Locale extends Facet {
  locale = "en_US";
  translate(id) {
    if (USE_TRANSLATIONS) {
      const translation = _ME_Translations[id];
      if(translation) return translation;
      return id;
    } else {
      debugMessage("LocaleFacet", colorWarn, "USE_TRANSLATIONS not set, skipping translate", {id});
      return id;
    }
  };
  translateWithParameters(id, params) {
    let translation = this.translate(id);
    if(!translation) return "Failed to translate: "+id;
    return sprintf(translation, ...params);
  };
  formatDate(date) {
    return new Date(date).toLocaleDateString();
  };
};


class DeviceInfo extends Facet {
  #div;
  constructor() {
    super()
    let div = document.createElement("div");
    div.style.width = "1cm";
    div.style.height = "1cm";
    div.style.position = "absolute";
    div.style.top = "10000px";
    this.#div = div;
  }

  get pixelsPerMillimeter() {
      return this.#div.getBoundingClientRect().width / 10;
  }

  get displayWidth() {
    return window.innerWidth;
  }

  get displayHeight() {
    return window.innerHeight;
  }

  inputMethods = [_ME_InputMethods.GAMEPAD_INPUT_METHOD, _ME_InputMethods.TOUCH_INPUT_METHOD, _ME_InputMethods.MOUSE_INPUT_METHOD];
  isLowMemoryDevice = false;
  guiScaleBase = 4;
  platform = _ME_Platforms.WIN32;
  guiScaleModifier = 0;
}


class SafeZone extends Facet {
  safeAreaX = 1;
  screenPositionX = 0;
  safeAreaY = 1;
  screenPositionY = 0;
};


class FeatureFlags extends Facet {
  flags = [
    "facet",
    "core.deviceInformation",
    "core.input",
    "core.locale",
    "core.router",
    "core.safeZone",
    "core.screenReader",
    "core.splitScreen",
    "vanilla.achievements",
    "vanilla.enableSeedTemplates",
    "vanilla.enableBehaviorPacksTab",
    "vanilla.enableResourcePacksTab",
    "vanilla.enableResourcePacksRealmsPlusFeatureFlag",
  ];
};


class SplitScreen extends Facet {
  numActivePlayers = 1;
  splitScreenDirection = 0;
  splitScreenPosition = 0;
};


const _ME_InputMethods = {
  GAMEPAD_INPUT_METHOD: 0,
  TOUCH_INPUT_METHOD: 1,
  MOUSE_INPUT_METHOD: 2,
  MOTION_CONTROLLER_INPUT_METHOD: 3,
};

class Input extends Facet {
  currentInputType = _ME_InputMethods.MOUSE_INPUT_METHOD;
  swapABButtons = false;
  acceptInputFromAllControllers = false;
  gameControllerId = 0;
  swapXYButtons = false;
};


class ScreenReader extends Facet {
  isChatTextToSpeechEnabled = false;
  isIdle = false;
  isUITextToSpeechEnabled = false;

  read(text, interuptable, required, play_in_background) {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  clear() {
    debugMessage("screenReaderFacet", colorDebug, "clear");
  }
};


class RouterFacetHistory {
  /** @argument router {Router} */
  constructor(router) {
    const hist = this;
    
    const onMessage = (m) => {
      if(m.data.pathname) {
        console.log(m.data);
        hist.location.pathname = m.data.pathname;
        if(m.data.content) {
          engine.bindings = {};
          document.write(m.data.content);
          document.close();
        } else {
          router.update();
        }
      }
    };
    window.addEventListener("message", onMessage);
    onGlobalListenerRemoval.addListener(() => {
      window.addEventListener("message", onMessage);
    });
  }

  location = {
    hash: "",
    search: "",
    state: "",
    pathname: "",
  }
  _ME_previousLocations = [];
  length = 5;
  action = "REPLACE";

  replace(path) {
    this._ME_previousLocations.push(this.location.pathname);
    this.action = "REPLACE";
    debugMessage("RouterFacet", colorInfo, "replacing path", path, this.location);
    gotoRoute(path);
  };

  goBack() {
    console.warn("goBack currently doesn't seem to work!");
    debugMessage("RouterFacet", colorInfo, "Back");
    const path = this._ME_previousLocations[this._ME_previousLocations.length - 2];
    gotoRoute(path);
    this._ME_previousLocations.pop();
  };

  push(path) {
    this.action = "PUSH";
    this._ME_previousLocations.push(this.location.pathname);
    debugMessage("RouterFacet", colorInfo, "push path", path);
    gotoRoute(path);
  };
}

function gotoRoute(path) {
  window.parent.postMessage({RouterEvent: path});
}

class Router extends Facet {
  engineUITransitionTime = 800;
  constructor() {
    super();
    this.history = new RouterFacetHistory(this);
  }
}


class CustomScaling extends Facet {
  scalingModeOverride = 0;
  fixedGuiScaleModifier = 0;
};


class Animation extends Facet {
  screenAnimationEnabled = true;
};


class Sound extends Facet {
  sound_definitions = {};
  constructor() {
    super();
    fetch("/hbui/sound_definitions.json")
      .then((response) => response.json())
      .then((sounddat) => {
        this.sound_definitions = sounddat;
        debugMessage("Sound Definitions", colorInfo, "Loaded!");
      });
  }

  play(id) {
    debugMessage("SoundFacet", colorInfo, `Sound ${id} requested.`);
    const soundData = this.sound_definitions[id];
    if(!soundData) {
      debugMessage("SoundFacet", colorError, {id}, "Not Found");
      return;
    }
    if(soundData.sounds.length == 0) {
      debugMessage("SoundFacet", colorError, {id}, "No Sounds");
      return;
    }

    const randomSound = soundData.sounds[Math.floor(Math.random() * soundData.sounds.length)].name;
    const audio = new Audio(randomSound);
    audio.play();
    return audio;
  };

  isPlaying(audio) {
    return !audio.ended;
  };

  fadeOut(audio) {
    audio.pause();
  };
};


class Social extends Facet {
};


class User extends Facet {
};


class performanceFacet extends Facet {
  frameTimeMs = 0;
  #last = performance.now();

  constructor() {
    super();
    this.#frame();
  }

  #frame() {
    const now = performance.now(); 
    const t = now - this.#last;
    this.#last = now;
    this.frameTimeMs = t;

    const handler = _ME_OnBindings[`facet:updated:core.performanceFacet`];
    if(handler) {
      handler(this);
    }
    requestAnimationFrame(() => {this.#frame()});
  }

  get gamefaceViewAdvanceTimeMs() {
    return this.frameTimeMs;
  }
};

//#endregion core



//#region vanilla

class Achievements extends Facet {
  status = 1;
  data = {
    achievementsUnlocked: 1,
    maxGamerScore: 90,
    hoursPlayed: 100,
    achievements: [
      {
        id: "0",
        name: "Placeholder Achievement",
        description: "Placeholderr!",
        gamerScore: 30,
        progress: 0,
        progressTarget: 0,
        isLocked: false,
        isSecret: false,
        dateUnlocked: Date.now(),
        hasReward: true,
        isRewardOwned: false,
        rewardId: "test",
        rewardName: "Test",
        rewardImage: "/hbui/assets/minecraft-texture-pack-31669.png",
      },
      {
        id: "1",
        name: "Placeholder Achievement",
        description: "Placeholderr!",
        gamerScore: 30,
        progress: 0,
        progressTarget: 0,
        isLocked: true,
        isSecret: false,
        dateUnlocked: 0,
        hasReward: true,
        isRewardOwned: false,
        rewardId: "test",
        rewardName: "Test",
        rewardImage: "/hbui/assets/minecraft-texture-pack-31669.png",
      },
      {
        id: "2",
        name: "Placeholder Achievement",
        description: "Placeholderr!",
        gamerScore: 30,
        progress: 0.5,
        progressTarget: 16,
        isLocked: true,
        isSecret: false,
        dateUnlocked: 0,
        hasReward: true,
        isRewardOwned: false,
        rewardId: "test",
        rewardName: "Test",
        rewardImage: "/hbui/assets/minecraft-texture-pack-31669.png",
      },
    ],
    currentGamerScore: 30,
    maxAchievements: 3,
  };
}

class AchievementsReward extends Facet {}


class CreateNewWorldBeta extends Facet {
  isBetaSupported = true;
  openFeedbackPage() {
    debugMessage("CNWBetaFacet", colorInfo, "openFeedbackPage()");
  };
  optOutOfBeta() {
    debugMessage("CNWBetaFacet", colorInfo, "optOutOfBeta()");
  };
};

class CreateNewWorld extends Facet {
  isEditorWorld = false;
  isUsingTemplate = false;
  isLockedTemplate = false;
  generalWarningState = 0;
  showedAchievementWarning = false;

  applyTemplate(a) {
    debugMessage("CNWFacet", colorInfo, "applyTemplate.bind()");
  };
  createOnRealms = {
    call: function () {
      debugMessage("CNWFacet", colorInfo, "createOnRealms.call()");
    },
    error: null,
  };

  worldCreationData = {
    general: {
      worldName: "Some World",
      difficulty: 0,
      gameMode: 0,
    },
    advanced: {
      useFlatWorld: false,
      simulationDistance: 8,
      startWithMap: false,
      bonusChest: false,
      showCoordinates: false,
      firesSpreads: true,
      tntExplodes: true,
      respawnBlocksExplode: true,
      mobLoot: true,
      naturalRegeneration: true,
      tileDrops: true,
      immediateRespawn: true,
      respawnRadius: "5", // Why would anyone in their right mind make this a STRING?!
      worldSeed: "",
    },
    cheats: {
      cheatsEnabled: false,
      tickSpeed: 20,
    },
    betaFeatures: [
      {
        id: "0",
        title: "Gameplay Experiment",
        description: "Riveting Gameplay Awaits!",
        isEnabled: false,
        category: 0,
      },
      {
        id: "1",
        title: "AddOn Experiment",
        description: "The Holiday Features that never were...",
        isEnabled: false,
        category: 1,
      },
      {
        id: "2",
        title: "Internal Experiment",
        description: "oooOOOoo Seecreet!",
        isEnabled: false,
        category: 2,
      },
    ],
    multiplayer: {
      generalWarningState: 0,
      multiplayerSupported: true,
      playerPermissions: 1,
      multiplayerGame: true,
      playerAccess: 1,
      visibleToLanPlayers: true,
      friendlyFire: true,
      platformPlayerAccess: 1,
      platformPlayerAccessSupported: true,
      platformPlayerAccessEnabled: true,
      platformPlayerInviteAccessSupported: true,
    },
  };
};

class VanillaOptions extends Facet {
  renderDistance = 5;
  defaultRenderDistance = 10;
};

class SeedTemplates extends Facet {
  templates = [
    {
      seedValue: "0",
      title: "The Nothing Seed",
      image: "/hbui/assets/world-preview-default-d72bc.jpg",
    }
  ];
};

class SimulationDistanceOptions extends Facet {
  simulationDistanceOptions = [4, 6, 8, 10];
};

class DebugSettings extends Facet {
  isBiomeOverrideActive = false;
  flatNether = false;
  dimension = 0;
  allBiomes = [
    {
      id: "0",
      label: "plains",
      dimension: 0,
    },
    {
      id: "1",
      label: "birch_forest",
      dimension: 0,
    },
    {
      id: "2",
      label: "jungle",
      dimension: 0,
    },
    {
      id: "3",
      label: "hell",
      dimension: 1,
    },
    {
      id: "4",
      label: "basalt_delta",
      dimension: 1,
    },
    {
      id: "5",
      label: "warped_forest",
      dimension: 1,
    },
  ];
  spawnDimensionId = 0;
  spawnBiomeId = 0;
  biomeOverrideId = 0;
  defaultSpawnBiome = 0;
};


class RealmsStories extends Facet {
  data = {
    stories: [
      {
        id: 1,
        isNewStoryPost: true,
        body: "Hello!",
        image: "/hbui/assets/world-preview-default-d72bc.jpg",
        author: {
          gamerTag: "SomeoneRandom",
        },
        timePosted: "Idk maybe 2022-01-01",
        totalComments: 1,
        totalLikes: 1,
        comments: [
          {
            body: "How did you get access to this?",
            author: {
              gamerTag: "Mojang",
            },
          }
        ],
      },
    ],
    members: [
      {
        gamerTag: "Mojang",
        isOnline: true,
        role: 2,
        profileStatus: 1,
        recentSessionsStatus: 1,
        recentSessions: [],
      },
      {
        gamerTag: "SomeoneRandom",
        gamerIcon: "/hbui/assets/minecraft-texture-pack-31669.png",
        isOnline: false,
        role: 1,
        profileStatus: 1,
        recentSessionsStatus: 1,
        recentSessions: [],
      },
    ],
  };
};

class ResourcePacks extends Facet {
  texturePacks = {
    activeGlobal: [],
    active: [],
    available: [
      {
        image: "/hbui/assets/minecraft-texture-pack-31669.png",
        name: "Minecraft",
        description: "A test resource pack!",
        id: "7f4bt1a2-43dd-45b1-aa3f-0b3ca2ebd5c8",
        contentId: "7f4bt1a2-43dd-45b1-aa3f-0b3ca2ebd5c8",
        isMarketplaceItem: false,
      }
    ],
    realms: [],
    unowned: [],
  };
  behaviorPacks = {
    active: [],
    available: [
      {
        image: "/hbui/assets/minecraft-texture-pack-31669.png",
        name: "Minecraft",
        description: "A test behavior pack!",
        id: "7f4bt1a2-43dd-45b1-aa3f-0b3ca2ebd5c8",
        contentId: "7f4bt1a2-43dd-45b1-aa3f-0b3ca2ebd5c8",
        isMarketplaceItem: false,
      }
    ],
  };
  status = 0;
  marketplacePackId = "1";
  userOwnsAtLeastOnePack = true;
  prompt = {
    actions: [],
    active: !1,
    body: "",
    handleAction: () => {
      debugMessage("RPFacet", colorInfo, "prompt.handleAction()");
    },
    id: "prompt",
    title: "",
  };
  activate() {
    debugMessage("RPFacet", colorInfo, "activate()");
  };
  deactivate() {
    debugMessage("RPFacet", colorInfo, "deactivate()");
  };
};



class UserAccount extends Facet {
  isTrialAccount = false;
  isLoggedInWithMicrosoftAccount = true;
  hasPremiumNetworkAccess = true;
  showPremiumNetworkUpsellModal() {
    debugMessage("UserAccountFacet", colorInfo, "showPremiumNetworkUpsellModal()");
  };
  showMicrosoftAccountLogInScreen() {
    debugMessage("UserAccountFacet", colorInfo, "showMicrosoftAccountLogInScreen()");
  };
};

class Telemetry extends Facet {
  fireEventButtonPressed(event) {
    debugMessage("VanillaTelem", colorDebug, "EventButtonPressed", {event: event});
  };
};

class PlayerMessagingService extends Facet {
  data = {
    messages: [
      {
        id: "0",
        template: "ImageText",
        surface: "LoginAnnouncement",
        additionalProperties: [
          {
            key: "header",
            value: "Test",
          },
          {
            key: "body",
            value: "Test",
          },
        ],
        images: [
          {
            id: "Primary",
            isLoaded: true,
            url: "/hbui/assets/world-preview-default-d72bc.jpg",
          },
        ],
        buttons: [
          {
            id: "Dismiss",
            text: "Test",
            reportClick: function () {
              console.log("[EngineWrapper/PlayerMessagingServiceFacet] reportClick()");
            },
          },
        ],
      },
      {
        id: "1",
        template: "ImageThumbnailCTA",
        surface: "LoginAnnouncement",
        additionalProperties: [
          {
            key: "header",
            value: "Hello World!",
          },
          {
            key: "body",
            value: "This is just a test!",
          },
        ],
        images: [
          {
            id: "Primary",
            isLoaded: true,
            url: "/hbui/assets/world-preview-default-d72bc.jpg",
          },
          {
            id: "Secondary",
            isLoaded: true,
            url: "/hbui/assets/world-preview-default-d72bc.jpg",
          },
        ],
        buttons: [
          {
            id: "CallToAction",
            text: "Hello?",
            reportClick: function () {
              console.log("[EngineWrapper/PlayerMessagingServiceFacet] reportClick()");
            },
          },
        ],
      },
      {
        id: "2",
        template: "HeroImageCTA",
        surface: "LoginAnnouncement",
        additionalProperties: [
          {
            key: "header",
            value: "Hello World!",
          },
          {
            key: "body",
            value: "This is just a test!",
          },
        ],
        images: [
          {
            id: "Primary",
            isLoaded: true,
            url: "/hbui/assets/world-preview-default-d72bc.jpg",
          },
        ],
        buttons: [
          {
            id: "CallToAction",
            text: "Hello?",
            reportClick: function () {
              console.log("[EngineWrapper/PlayerMessagingServiceFacet] reportClick()");
            },
          },
        ],
      },
    ],
  };
  reportClick(a) {
    console.log("[EngineWrapper/PlayerMessagingServiceFacet] reportClick.bind()");
  };
  reportDismiss(a) {
    console.log("[EngineWrapper/PlayerMessagingServiceFacet] reportClick.bind()");
  };
};

class PlayerReport extends Facet {
  reportPlayer(whereReport, reason, message, xuid, uuid) {
    console.log("[EngineWrapper/PlayerReportFacet] reportPlayer()");
  }
};

class PlayerBanned extends Facet {
  openBannedInfoPage() {
    console.log("[EngineWrapper/PlayerBannedFacet] openBannedInfoPage()");
  };
};

class MarketplaceSuggestions extends Facet {
  getMorePacks = {
    title: "test",
    pageId: 0,
  }
};

class BuildSettings extends Facet {
  isEduBuild = true;
  isDevBuild = true;
};







const _ME_EditorFileFlags = {
  None: 0,
  New: 1,
  Export: 2,
  Close: 4,
  Exit: 8,
};
const _ME_EditorEditFlags = {
  None: 0,
  Undo: 1,
  Redo: 2,
  Settings: 4,
};
const _ME_EditorWindowFlags = {
  None: 0,
  Preview: 1,
  Selection: 2,
  Palette: 4,
  ShowUI: 8,
  ResetUI: 16,
};
const _ME_EditorHelpFlags = {
  None: 0,
  Support: 1,
  FAQ: 2,
  Documentation: 4,
};
const _ME_EditorPrototypeFlags = {
  None: 0,
  Restart: 1,
  SelectFlow: 2,
  BrushFlow: 4,
  CopyFlow: 8,
  StampFlow: 16,
  CreativePaletteFlow: 32,
};
const _ME_EditorActionFlags = {
  None: 0,
  Undo: 1,
  Redo: 2,
  Cut: 4,
  Copy: 8,
  Paste: 16,
  Players: 32,
  Sessions: 64,
};
const _ME_EditorThemes = {
  Dark: 0,
  Light: 1,
  Redstone: 2,
  HightContrast: 3,
};


class Editor extends Facet {
  editorTools = {
    selectedTool: 0,
  };
  fileFlags = _ME_EditorFileFlags.New;
  editFlags = _ME_EditorEditFlags.Settings;
  windowFlags = _ME_EditorWindowFlags.ShowUI;
  helpFlags = _ME_EditorHelpFlags.Documentation;
  prototypeFlags = _ME_EditorPrototypeFlags.Restart;
  actionFlags = _ME_EditorActionFlags.Players;
  editorSettings = {
    theme: _ME_EditorThemes.Dark,
  }
};

class EditorInput extends Facet {};

//#endregion vanilla


//#region badger


const loggingHandler = {
  get(target, property) {
    const v = target[property];
    if(v === undefined && property.__proto__.constructor.name != "Symbol") {
      debugMessage(`DUMMY ${target.__proto__.constructor.name}`, colorDebug, property);
    }
    return v;
  },
};

function dummyFacet(target, name = null) {
  if(name != null) target.__proto__.constructor.name = name;
  return new Proxy(target, loggingHandler)
}


class genericPreGame extends Facet {
  isPublishBuild = false
  isPersonaAppearanceRequestActive = false
  shouldPlaySplashVideo = false
  shouldPlayLogoVideo = false
  showTutorialCompleteModal = false
  usedStorageMb = 4200000
  totalStorageMb = 4260000

  mythsDLCMetaDataIds = []
  lostLegendsDLCMetaDataIds = []
  heroSkins = []
  personas = []
}

class genericPreGameMethods extends Facet {
  signedOutModalData = {
    title: "Signed Out",
    body: "lorem ipsum!",
    confirm: () => {}
  }
  multiplayerBlockedErrorModalData = dummyFacet({
    title: "title",
    body: "body",
    confirm: () => {
      gotoRoute("/badger/mainMenu")
    },
    cancel: () => {}
  })
  updateCharacterSceneToSavedCharacter = () => {
  }
  setCharacterScene = () => {
    console.log("setCharacterScene");
  }
  checkHasEnoughStorage = () => {
    console.log("checkHasEnoughStorage");
  }
}


class genericCommon extends Facet {
  localPlayerPlatform = 0
  uiStyle = 0
  isNetworkAvailable = true
  isConnectedXBL = true
  isCrossPlayEnabled = true
  isMultiplayerAllowed = true
  isConnectedPlatform = true
  isHost = true
  isMatchmaking = false
  fontScale = 1

  localPlayerPlatformName = "IP_Justice"
  localPlayerUUID = "uuid"
  localPlayerPlatformProfilePicture = "https://cdn.discordapp.com/avatars/833758710861922387/c035dd7ad20761330a03d0360ad0d967.webp?size=128"
  localPlayerXBLProfilePicture = "https://cdn.discordapp.com/avatars/833758710861922387/c035dd7ad20761330a03d0360ad0d967.webp?size=128"
  gamerTag = "IP_Justice"
  playerList = []
}
class genericCommonMethods extends Facet {
  msaLinkModalData = dummyFacet({

  }, "msaLinkModalData")
}

class badgerCommonInput extends Facet {
  remappingButtonData = [
    dummyFacet({})
  ]
}

class badgerCommonInputMethods extends Facet {
  setUIIsGamepad(val) {}
}

class settings extends Facet {
  settingCategories = [
    "debug"
  ]
  settings = [
    dummyFacet({
      category: "debug",
      subcategories: []
    }, "settings page")
  ]
  showPrivacyChangedNoInternetModal = false
}

class settingsMethods extends Facet {
  setSettingCategory() {
    console.log("setSettingCategory")
  }
  initRemappingEventHandler() {
    console.log("initRemappingEventHandler")
  }
}

class endCredits extends Facet {
  creditsText = ["me lol"]
}

class playerInfo extends Facet {
  currentHealth = 20
  totalHealth = 20
  isTakingDamage = false

  playerRespawnTimer = 3
  playerRespawnTimerMax = 5
  playerRespawnPostDelayTimerMax = 5
}

class hudLowVolume extends Facet {
  hudMessages = []
  logMessages = []
  cinematicData = []
  hudVisibility = []
  isTapToSkipCinematic = false
  skipCinematicWindowOpen = false
  cinematicSkipState = false
}
class Hotbar extends Facet {
  hotbarTooltipErrorMessages = []
  hotbarItems = []
  currentHotbarSlot = 0
  currentToolbarId = 0
  hotbarQuickBuildItem = null
  showToolbarDisplay = true
  fadeOutTooltipTimer = 3
}
class badgerInput extends Facet {
  buttonMappingData = []
  keyStates = []
  actionKeysPressed = []
  currentInputMethod = 0
}
class subtitles extends Facet {
  VOSubtitles = []
  devSubtitles = []
}
class highVolume extends Facet {
  objectiveHealthBars = []
  onscreenWaypointMarkers = []
  bottomCompassMarkers = []
  topCompassMarkers = []
  displayedGlobalTimer = true
  cameraDirection = 0
}
class genericInGame extends Facet {
  emphasizedHUDItems = []
  isPlayingFMV = false
}
class genericInGameMethods extends Facet {
  onScreenOpened(screen) {
    debugMessage("genericInGameMethods", colorInfo, "onScreenOpened", screen);
  }
}

class hud extends Facet {
  canAffordBuildable = true
  isInBattleView = false
  isInBuildPreview = false
  showSongbookIndicator = false
  interactableBuilding = ""
  hudElementFading = false
  hudElementVisibility = false
}

class ticketTimers extends Facet {}
class resources extends Facet {
  economyTickets = []
  hudTeamResources = []
  hudContextualResources = []
  economyTicketDeltas = []
  spawnCostDeltas = []
}
class radialMenu extends Facet {
  isMenuShowing = false
  currentLuredUnitCount = 0
  currentLuredUnitType = 0
  lureCap = 5
  isHeroLuring = false
  isHeroDirecting = false
}
class debugDraw extends Facet {

}

class songbook extends Facet {
  songbookCategories = []
}
class uiEvent extends Facet {}

class badgerStartMenu extends Facet {}
class badgerStartMenuMethods extends Facet {
  openSettings() {
    gotoRoute("/badger/settings");
  }
  openMarketplace() {
    gotoRoute("/badger/marketplace")
  }
  openLegendsHub() {
    gotoRoute("/badger/legendsHub")
  }
  startGamePVPHub() {
    gotoRoute("/badger/pvpLobby")
  }
  startGameCampaignHub() {
    gotoRoute("/badger/campaignLobby")
  }
}

class lobby extends Facet {
  lostLegendsHubHostGameModes = []
  campaignHubHostGameModes = []
  campaignHubDiscoveryGameModes = []
  multiplayerHubDiscoveryGameModes = []
  mythsHubHostGameModes = []
  multiplayerHubHostGameModes = [
    dummyFacet({
      modeName: "conquest_practice",
      isPracticeMode: true
    }, "game mode")
  ]
  lobbyGameModeData = {
    isPracticeMode: false,
    allowMatchmaking: true,
    maxPlayerCount: 8,
    modeName: "ModeName"
  }
  lobbyTitle = "fortnite battle royale"
  lobbyPrivacy = false
  minPlayerCount = 1
  lobbyMaxSlots = 4
  isMinPlayerCheckDisabled = true
  lobbyStartMatchTimer = 1
  teamSwitching = true
  failedToMatchmake = false
  lobbyChatMessages = []
}
class lobbyMethods extends Facet {
  startMatchmaking = () => {
  }
  exitLobby = () => {
    gotoRoute("/badger/mainMenu");
  }
  findGame = () => {
    console.log("findGame");
  }
}

class screenUtil extends Facet {}
class screenUtilMethods extends Facet {
  goBackToMainMenu = () => {
    gotoRoute("/badger/mainMenu");
  }
}

class marketplace extends Facet {
  isInventoryView = false
  isMarketplaceRoot = false
  isPremiumPurchaseError = false
  isBalancePendingRefresh = false
  marketplaceModalDisplayed = false
  marketplaceModalCancellable = true
  newLostLegendRewardModalDisplayed = false
  isMinecoinOffersLoaded = true

  purchaseResponse = dummyFacet({})
  pageView = dummyFacet({})
  purchasableMinecoinPacks = []

  balance = 100
  localPlayerPlatformName = "username!"
}
class marketplaceMethods extends Facet {
  onOfferPurchaseModalDisplayStateChanged = () => {

  }
  onMinecoinPurchaseModalDisplayStateChanged = () => {

  }

  setIsInventoryView = (value) => {
    const marketplace = engine.getFacet("badger.marketplace");
    marketplace.isInventoryView = value;
    marketplace.update();
  }

  goToStoreRoot = () => {
    gotoRoute("/badger/marketplace");
  }

  marketplaceModalData = dummyFacet({
    title: "Modal",
    body: "body"
  }, "marketplaceModalData")

  newLostLegendRewardModalData = dummyFacet({
    title: "New Lost Legend",
    body: "lorem ipsum or whatever",
    image: "https://picsum.photos/200/300"
  }, "newLostLegendRewardModalData")
}

class badgerInvite extends Facet {
  inGameLobby = false
  reportPlayerResult = dummyFacet({}, "reportPlayerResult")
  legendFilterLocString = "hbui.friendsSidebar.filterAll"
  friends = [
    dummyFacet({
      playingBadger: true,
      invitable: true,
      joinable: true,
      online: true,
      status: 1,
      platformType: 1,
      platformId: 1,
      picture: "https://pbs.twimg.com/profile_images/811541117644800000/35DkAsO8_400x400.jpg",
      name: "jeb_",
      xuid: 20042324324
    }, "friend")
  ]
  findPlayerResult = dummyFacet({}, "findPlayerResult")
}
class badgerInviteMethods extends Facet {
  refreshFriendsList = () => {}
  resetFindPlayerResult = () => {}
}

class networkWorlds extends Facet {
  friendsWorlds = []
  lanWorlds = []
  crossPlatformFriendsWorlds = []
}

class networkWorldsMethods extends Facet {
  setUpdateWorldListState = () => {}
}

class localWorlds extends Facet {
  isDeleting = false
  worlds = []
}
class localWorldsMethods extends Facet {}

class loadingScreen extends Facet {
  loadIsCancellable = true
  isLoading = false
  loadingMessage = "creepers go explody sometimes ig"
}
class loadingScreenMethods extends Facet {}

//#endregion badger

const _ME_Facets = {
  // == Core Facets == //
  "core.locale": Locale,
  "core.deviceInformation": DeviceInfo,
  "core.safeZone": SafeZone,
  "core.featureFlags": FeatureFlags,
  "core.splitScreen": SplitScreen,
  "core.input": Input,
  "core.screenReader": ScreenReader,
  "core.router": Router,
  "core.customScaling": CustomScaling,
  "core.animation": Animation,
  "core.sound": Sound,
  "core.social": Social,
  "core.user": User,
  "core.performanceFacet": performanceFacet,
  // == Vanilla Facets == //
  "vanilla.achievements": Achievements,
  "vanilla.achievementsReward": AchievementsReward,
  "vanilla.createNewWorld": CreateNewWorld,
  "vanilla.telemetry": Telemetry,
  "vanilla.createNewWorldBeta": CreateNewWorldBeta,
  "vanilla.userAccount": UserAccount,
  "vanilla.buildSettings": BuildSettings,
  "vanilla.debugSettings": DebugSettings,
  "vanilla.resourcePacks": ResourcePacks,
  "vanilla.options": VanillaOptions,
  "vanilla.simulationDistanceOptions": SimulationDistanceOptions,
  "vanilla.seedTemplates": SeedTemplates,
  "vanilla.realmsStories": RealmsStories,
  "vanilla.playermessagingservice": PlayerMessagingService,
  "vanilla.playerReport": PlayerReport,
  "vanilla.marketplaceSuggestions": MarketplaceSuggestions,
  "vanilla.playerBanned": PlayerBanned,
  "vanilla.editor": Editor,
  "vanilla.editorInput": EditorInput,
  // == Badger Facets == //
  "badger.genericPreGame": genericPreGame,
  "badger.genericPreGameMethods": genericPreGameMethods,

  "badger.genericInGame": genericInGame,
  "badger.genericInGameMethods": genericInGameMethods,

  "badger.badgerStartMenu": badgerStartMenu,
  "badger.badgerStartMenuMethods": badgerStartMenuMethods,

  "badger.lobby": lobby,
  "badger.lobbyMethods": lobbyMethods,

  "badger.settings": settings,
  "badger.settingsMethods": settingsMethods,

  "badger.screenUtil": screenUtil,
  "badger.screenUtilMethods": screenUtilMethods,

  "badger.badgerCommonInput": badgerCommonInput,
  "badger.badgerCommonInputMethods": badgerCommonInputMethods,

  "badger.marketplace": marketplace,
  "badger.marketplaceMethods": marketplaceMethods,

  "badger.badgerInvite": badgerInvite,
  "badger.badgerInviteMethods": badgerInviteMethods,

  "badger.genericCommon": genericCommon,
  "badger.genericCommonMethods": genericCommonMethods,

  "badger.playerInfo": playerInfo,
  "badger.endCredits": endCredits,

  "badger.hud": hud,
  "badger.hudLowVolume": hudLowVolume,
  "badger.hotbar": Hotbar,
  "badger.badgerInput": badgerInput,
  "badger.subtitles": subtitles,
  "badger.highVolume": highVolume,
  "badger.radialMenu": radialMenu,
  "badger.resources": resources,
  "badger.ticketTimers": ticketTimers,
  "badger.debugDraw": debugDraw,
  "badger.songbook": songbook,
  "badger.uiEvent": uiEvent,
  "badger.networkWorlds": networkWorlds,
  "badger.networkWorldsMethods": networkWorldsMethods,

  "badger.localWorlds": localWorlds,
  "badger.localWorldsMethods": localWorldsMethods,

  "badger.loadingScreen": loadingScreen,
  "badger.loadingScreenMethods": loadingScreenMethods
};


class TriggerEvent {
  apply(unk, data) {
    const eventType = data[0];
    switch (eventType) {
      case "facet:request":
        const facetName = data[1][0];
        const facet = engine.getFacet(facetName);
        if (facet) {
          debugMessage("TriggerEvent", colorInfo, "Sending Facet", facetName);
          facet.update();
        } else {
          debugMessage("TriggerEvent", colorError, "MISSING FACET", facetName);
          facet.error();
        }
        break;
    
      case "core:exception":
        const message = data[1];
        debugMessage("TriggerEvent", colorError, "oreUI guest has reported exception", message);
        break;
      
      case "facet:discard":
        break;

      default:
        debugMessage("TriggerEvent", colorWarn, `OreUI triggered ${eventType} but we don't handle it!`)
        break;
    }
  };
}

class Engine {
  /** @type {{[k: string]: Facet}} */
  facets = {}
  bindings = {}
  createFacets() {
    for(const name of Object.keys(_ME_Facets)) {
      const facet = dummyFacet(new _ME_Facets[name]);
      this.facets[name] = facet;
      facet.facetName = name;
    }
  }

  getFacet(name) {
    return this.facets[name];
  }

  constructor() {
    this.TriggerEvent = new TriggerEvent();    
    this.isAttached = false;
    this.createFacets();
  }

  on(event, callback) {
    debugMessage("engine.on", colorInfo, {event: event});
  }

  off(event, callback) {
    debugMessage("engine.off", colorInfo, {event: event});
  }

  AddOrRemoveOnHandler(id, func, unk) {
    /*
    debugMessage("AddOrRemoveOnHandler", colorInfo, {
      ID: id,
      Function: func,
    });
    */
    this.bindings[id] = func;
  }

  RemoveOnHandler(id, func, unk) {
    debugMessage("RemoveOnHandler", colorInfo, {
      ID: id,
      Function: func,
    });
    delete this.bindings[id];
  }

  AddOrRemoveOffHandler(id) {
    debugMessage("AddOrRemoveOffHandler", colorInfo, {
      ID: id,
    });
    return true;
  }

  BindingsReady() {
    debugMessage("BindingsReady", colorDebug);
  }
}

const engine = new Engine();
window.engine = engine;
