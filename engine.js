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


//#region core

class LocaleFacet {
  locale = "en_US";
  translate(id) {
    if (USE_TRANSLATIONS) {
      return _ME_Translations[id];
    } else {
      debugMessage("LocaleFacet", colorWarn, "USE_TRANSLATIONS not set, skipping translate", {id});
      return id;
    }
  };
  translateWithParameters(id, params) {
    let translation = this.translate(id);
    for (let i = 1; i <= params.length; i++) {
      translation = translation?.replaceAll("%" + i + "$s", params[i - 1])
    };
    return translation;
  };
  formatDate(date) {
    return new Date(date).toLocaleDateString();
  };
};


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

class DeviceInfoFacet {
  #div;
  constructor() {
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


class SafeZoneFacet {
  safeAreaX = 1;
  screenPositionX = 0;
  safeAreaY = 1;
  screenPositionY = 0;
};


class FeatureFlagsFacet {
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


class SplitScreenFacet {
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

class InputFacet {
  currentInputType = _ME_InputMethods.MOUSE_INPUT_METHOD;
  swapABButtons = false;
  acceptInputFromAllControllers = false;
  gameControllerId = 0;
  swapXYButtons = false;
};


class ScreenReaderFacet {
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
  constructor(router) {
    // hash changes MUST be triggered by parent page changing the url
    window.addEventListener("hashchange", (ev) => {
      const pathname = new URL(ev.newURL).hash.slice(1);
      console.log("pathname", pathname, this.location)
      this.location.pathname = pathname;

      const handler = _ME_OnBindings[`facet:updated:core.router`];
      if(handler) {
        handler(this.router);
      }
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

class RouterFacet {
  engineUITransitionTime = 800;
  constructor() {
    this.history = dummyFacet(new RouterFacetHistory(this));
  }
}


class CustomScalingFacet {
  scalingModeOverride = 0;
  fixedGuiScaleModifier = 0;
};


class AnimationFacet {
  screenAnimationEnabled = true;
};


class SoundFacet {
  sound_definitions = {};
  constructor() {
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


class SocialFacet {};


class UserFacet {};


class performanceFacet {
  frameTimeMs = 0;
  #last = performance.now();

  constructor() {
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

class AchievementsFacet {
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

class AchievementsRewardFacet {}


class CreateNewWorldBetaFacet {
  isBetaSupported = true;
  openFeedbackPage() {
    debugMessage("CNWBetaFacet", colorInfo, "openFeedbackPage()");
  };
  optOutOfBeta() {
    debugMessage("CNWBetaFacet", colorInfo, "optOutOfBeta()");
  };
};

class CreateNewWorldFacet {
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

class VanillaOptionsFacet {
  renderDistance = 5;
  defaultRenderDistance = 10;
};

class SeedTemplatesFacet {
  templates = [
    {
      seedValue: "0",
      title: "The Nothing Seed",
      image: "/hbui/assets/world-preview-default-d72bc.jpg",
    }
  ];
};

class SimulationDistanceOptionsFacet {
  simulationDistanceOptions = [4, 6, 8, 10];
};

class DebugSettingsFacet {
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


class RealmsStoriesFacet {
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

class ResourcePacksFacet {
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



class UserAccountFacet {
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

class TelemetryFacet {
  fireEventButtonPressed(event) {
    debugMessage("VanillaTelem", colorDebug, "EventButtonPressed", {event: event});
  };
};

class PlayerMessagingServiceFacet {
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

class PlayerReportFacet {
  reportPlayer(whereReport, reason, message, xuid, uuid) {
    console.log("[EngineWrapper/PlayerReportFacet] reportPlayer()");
  }
};

class PlayerBannedFacet {
  openBannedInfoPage() {
    console.log("[EngineWrapper/PlayerBannedFacet] openBannedInfoPage()");
  };
};

class MarketplaceSuggestionsFacet {
  getMorePacks = {
    title: "test",
    pageId: 0,
  }
};

class BuildSettingsFacet {
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


class EditorFacet {
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

class EditorInputFacet {};

//#endregion vanilla


//#region badger


const loggingHandler = {
  get(target, property) {
    const v = target[property];
    if(v === undefined) {
      debugMessage(`DUMMY ${target.__proto__.constructor.name}`, colorDebug, property);
    }
    return v;
  },
};

function dummyFacet(target) {
  return new Proxy(target, loggingHandler)
}


class genericPreGameFacet {
  isPublishBuild = false
  shouldPlaySplashVideo = false
  shouldPlayLogoVideo = false
}

class genericPreGameMethods {

}


class genericCommonFacet {
  localPlayerPlatform = 0
  uiStyle = 0
}
class genericCommonMethodsFacet {}

class badgerCommonInputFacet {
  remappingButtonData = []
}

class settingsFacet {
  settingCategories = []
}

class settingsMethodsFacet {
  setSettingCategory() {
    console.log("setSettingCategory")
  }
  initRemappingEventHandler() {
    console.log("initRemappingEventHandler")
  }
}

class endCreditsFacet {
  creditsText = ["me lol"]
}

class badgerCommonInputMethodsFacet {
  setUIIsGamepad(val) {}
  
  toPrimitive() {
    return []
  }
}

class playerInfoFacet {
  currentHealth = 20
  totalHealth = 20
  isTakingDamage = false
}

class hudLowVolumeFacet {
  hudMessages = []
  logMessages = []
  cinematicData = []
  hudVisibility = []
  isTapToSkipCinematic = false
  skipCinematicWindowOpen = false
  cinematicSkipState = false
}
class HotbarFacet {
  hotbarTooltipErrorMessages = []
  hotbarItems = []
  currentHotbarSlot = 0
  currentToolbarId = 0
  hotbarQuickBuildItem = null
  showToolbarDisplay = true
}
class badgerInputFacet {
  buttonMappingData = []
  keyStates = []
  actionKeysPressed = []
  currentInputMethod = 0
}
class subtitlesFacet {
  VOSubtitles = []
  devSubtitles = []
}
class highVolumeFacet {
  objectiveHealthBars = []
  onscreenWaypointMarkers = []
  bottomCompassMarkers = []
  topCompassMarkers = []
  displayedGlobalTimer = true
}
class genericInGameFacet {
  emphasizedHUDItems = []
}
class genericInGameMethodsFacet {
  onScreenOpened(screen) {
    debugMessage("genericInGameMethods", colorInfo, "onScreenOpened", screen);
  }
}

class hudFacet {
  canAffordBuildable = true
  isInBattleView = false
  isInBuildPreview = false
  showSongbookIndicator = false
  interactableBuilding = false
}
class ticketTimersFacet {}
class resourcesFacet {
  economyTickets = []
  hudTeamResources = []
  hudContextualResources = []
}
class radialMenuFacet {
  isMenuShowing = false
  currentLuredUnitCount = 0
  currentLuredUnitType = 0
  lureCap = 5
  isHeroLuring = false
  isHeroDirecting = false
}
class debugDrawFacet {

}

class songbookFacet {}
class uiEventFacet {}

class badgerStartMenuFacet {}
class badgerStartMenuMethodsFacet {
  openSettings() {
    gotoRoute("/badger/settings");
  }
}

class lobbyFacet {}
class lobbyMethodsFacet {}

class screenUtilFacet {}
class screenUtilMethodsFacet {}

class marketplaceFacet {}
class marketplaceMethodsFacet {}

class badgerInviteFacet {}
class badgerInviteMethodsFacet {}

//#endregion badger

const _ME_Facets = {
  // == Core Facets == //
  "core.locale": LocaleFacet,
  "core.deviceInformation": DeviceInfoFacet,
  "core.safeZone": SafeZoneFacet,
  "core.featureFlags": FeatureFlagsFacet,
  "core.splitScreen": SplitScreenFacet,
  "core.input": InputFacet,
  "core.screenReader": ScreenReaderFacet,
  "core.router": RouterFacet,
  "core.customScaling": CustomScalingFacet,
  "core.animation": AnimationFacet,
  "core.sound": SoundFacet,
  "core.social": SocialFacet,
  "core.user": UserFacet,
  "core.performanceFacet": performanceFacet,
  // == Vanilla Facets == //
  "vanilla.achievements": AchievementsFacet,
  "vanilla.achievementsReward": AchievementsRewardFacet,
  "vanilla.createNewWorld": CreateNewWorldFacet,
  "vanilla.telemetry": TelemetryFacet,
  "vanilla.createNewWorldBeta": CreateNewWorldBetaFacet,
  "vanilla.userAccount": UserAccountFacet,
  "vanilla.buildSettings": BuildSettingsFacet,
  "vanilla.debugSettings": DebugSettingsFacet,
  "vanilla.resourcePacks": ResourcePacksFacet,
  "vanilla.options": VanillaOptionsFacet,
  "vanilla.simulationDistanceOptions": SimulationDistanceOptionsFacet,
  "vanilla.seedTemplates": SeedTemplatesFacet,
  "vanilla.realmsStories": RealmsStoriesFacet,
  "vanilla.playermessagingservice": PlayerMessagingServiceFacet,
  "vanilla.playerReport": PlayerReportFacet,
  "vanilla.marketplaceSuggestions": MarketplaceSuggestionsFacet,
  "vanilla.playerBanned": PlayerBannedFacet,
  "vanilla.editor": EditorFacet,
  "vanilla.editorInput": EditorInputFacet,
  // == Badger Facets == //
  "badger.genericPreGame": genericPreGameFacet,
  "badger.genericPreGameMethods": genericPreGameMethods,

  "badger.genericInGame": genericInGameFacet,
  "badger.genericInGameMethods": genericInGameMethodsFacet,

  "badger.badgerStartMenu": badgerStartMenuFacet,
  "badger.badgerStartMenuMethods": badgerStartMenuMethodsFacet,

  "badger.lobby": lobbyFacet,
  "badger.lobbyMethods": lobbyMethodsFacet,

  "badger.settings": settingsFacet,
  "badger.settingsMethods": settingsMethodsFacet,

  "badger.screenUtil": screenUtilFacet,
  "badger.screenUtilMethods": screenUtilMethodsFacet,

  "badger.badgerCommonInput": badgerCommonInputFacet,
  "badger.badgerCommonInputMethods": badgerCommonInputMethodsFacet,

  "badger.marketplace": marketplaceFacet,
  "badger.marketplaceMethods": marketplaceMethodsFacet,

  "badger.badgerInvite": badgerInviteFacet,
  "badger.badgerInviteMethods": badgerInviteMethodsFacet,

  "badger.genericCommon": genericCommonFacet,
  "badger.genericCommonMethods": genericCommonMethodsFacet,

  "badger.playerInfo": playerInfoFacet,
  "badger.endCredits": endCreditsFacet,

  "badger.hud": hudFacet,
  "badger.hudLowVolume": hudLowVolumeFacet,
  "badger.hotbar": HotbarFacet,
  "badger.badgerInput": badgerInputFacet,
  "badger.subtitles": subtitlesFacet,
  "badger.highVolume": highVolumeFacet,
  "badger.radialMenu": radialMenuFacet,
  "badger.resources": resourcesFacet,
  "badger.ticketTimers": ticketTimersFacet,
  "badger.debugDraw": debugDrawFacet,
  "badger.songbook": songbookFacet,
  "badger.uiEvent": uiEventFacet,
};

for(const name of Object.keys(_ME_Facets)) {
    _ME_Facets[name] = dummyFacet(_ME_Facets[name]);
}
window._ME_Facets = _ME_Facets;


class TriggerEvent {
  constructor(engine) {
    this.engine = engine
  }

  apply(unk, data) {
    const eventType = data[0];
    switch (eventType) {
      case "facet:request":
        const facetName = data[1][0];
        const facet = this.engine.facets[facetName];
        if (facet) {
          debugMessage("TriggerEvent", colorInfo, "Sending Facet", facetName);
          const handler = _ME_OnBindings[`facet:updated:${facetName}`];
          if(handler) handler(facet);
        } else {
          debugMessage("TriggerEvent", colorError, "MISSING FACET", facetName);
          const handler = _ME_OnBindings[`facet:error:${facetName}`];
          if(handler) handler(facet);
        }
        break;
    
      case "core:exception":
        const message = data[1];
        debugMessage("TriggerEvent", colorError, "oreUI guest has reported exception", message);
        break;

      default:
        debugMessage("TriggerEvent", colorWarn, `OreUI triggered ${eventType} but we don't handle it!`)
        break;
    }
  };
}

class Engine {
  facets = {}
  createFacets() {
    for(const name of Object.keys(_ME_Facets)) {
      this.facets[name] = dummyFacet(new _ME_Facets[name]);
    }
  }

  constructor() {
    this.TriggerEvent = new TriggerEvent(this);    
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
    debugMessage("AddOrRemoveOnHandler", colorInfo, {
      ID: id,
      Function: func,
    });
    _ME_OnBindings[id] = func;
  }
  RemoveOnHandler(id, func, unk) {
    debugMessage("RemoveOnHandler", colorInfo, {
      ID: id,
      Function: func,
    });
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

const engine = dummyFacet(new Engine());
window.engine = engine;
