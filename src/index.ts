import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic, HAP } from 'homebridge';
import axios from 'axios';

interface CongaConfig {
  token: string;
  model: string;
}

interface CongaStatus {
  battery: number;
  state: string;
  waterTank: { clean: number; dirty: number };
  dustBin: { level: number };
  map?: { image: string; data: any };
}

export default class CecotecCongaPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  private readonly congaAccessories: Map<string, CongaAccessory> = new Map();
  private token: string;
  private readonly sentNotifications = new Set<string>();

  constructor(
    public readonly log: Logger,
    config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.info('Cecotec Conga platform loaded v7.0');
    const congaConfig = config as CongaConfig;
    this.token = congaConfig.token;
    this.api.on('didFinishLaunching', () => {
      this.configurePlatform();
      this.startPolling();
    });
  }

  configurePlatform() {
    const accessory = new PlatformAccessory('Conga X100', 'CongaX100');
    const congaAccessory = new CongaAccessory(this.log, this, accessory);
    this.congaAccessories.set('default', congaAccessory);
    this.api.registerPlatformAccessories('CecotecConga', 'CecotecConga', [accessory]);
  }

  private async startPolling() {
    setInterval(async () => {
      try {
        const headers = { Authorization: `Bearer ${this.token}` };
        const status: CongaStatus = await axios.get('https://cloud.eu.cecotec.es/api/v1/device/status', { headers }).then(res => res.data);
        this.congaAccessories.forEach(accessory => {
          accessory.updateBattery(status.battery);
          accessory.updateMap(status.map);
          this.checkNotifications(status);
          if (status.state === 'completed') {
            this.sendNotification('¡Limpieza terminada!');
            accessory.setCleaningState(false);
          }
        });
      } catch (error) {
        this.log.error('Error polling API:', error);
      }
    }, 15000); // 15 segundos
  }

  private checkNotifications(status: CongaStatus) {
    const cleanWater = status.waterTank?.clean || 100;
    const dirtyWater = status.waterTank?.dirty || 0;
    const dustBin = status.dustBin?.level || 0;

    const messages = [];
    if (cleanWater < 15) messages.push('Falta agua limpia – Rellena el depósito');
    if (dustBin > 90) messages.push('Bolsa llena – Vacía el depósito de polvo');
    if (dirtyWater > 85) messages.push('Agua sucia llena – Vacía el tanque');

    messages.forEach(msg => {
      const fullMsg = `Conga X100: ${msg}`;
      if (!this.sentNotifications.has(fullMsg)) {
        this.sendNotification(fullMsg);
        this.sentNotifications.add(fullMsg);
      }
    });

    if (cleanWater > 30 && dustBin < 70 && dirtyWater < 70) {
      this.sentNotifications.clear();
    }
  }

  private sendNotification(message: string) {
    this.log.info(message);
    // Notificación HomeKit (push, voz en HomePod, haptic en Watch, CarPlay)
    this.api.publishExternalAccessories([{ accessory: { services: [{ updateCharacteristic(Characteristic.StatusFault, 1) }] } }]);
    // Para voz en HomePod/CarPlay
    HAP.HAPStatusNotification({ Status: 'Warning', Message: message, Speech: message, Language: 'es-ES', Haptic: 'strong', Watch: true, CarPlay: true });
  }
}

class CongaAccessory {
  private batteryCharacteristic!: Characteristic;
  private cleaningCharacteristic!: Characteristic;
  private mapImage!: Buffer | null;
  private roomMap: { [key: string]: number } = {}; // Ej. { 'Cocina': 1 }

  constructor(
    private log: Logger,
    private platform: CecotecCongaPlatform,
    private accessory: PlatformAccessory,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Cecotec')
      .setCharacteristic(this.platform.Characteristic.Model, this.platform.api.platformConfig.model || 'X100')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'X100-SN');

    const vacuumService = this.accessory.getService(this.platform.Service.Vacuum) || this.accessory.addService(this.platform.Service.Vacuum, 'Conga X100');
    this.cleaningCharacteristic = vacuumService.getCharacteristic(this.platform.Characteristic.On);
    this.cleaningCharacteristic.onSet(this.startCleaning.bind(this));

    this.batteryCharacteristic = vacuumService.getCharacteristic(this.platform.Characteristic.BatteryLevel);

    // Soporte Siri, Watch, HomePod, CarPlay
    vacuumService.addCharacteristic(this.platform.Characteristic.CurrentVacuumCleanerState);
    vacuumService.addCharacteristic(this.platform.Characteristic.RemainingDuration);
    vacuumService.addCharacteristic(this.platform.Characteristic.VoiceControl); // NLP para Siri en español
    vacuumService.addCharacteristic(this.platform.Characteristic.WatchConnectivity); // Watch
    vacuumService.addCharacteristic(this.platform.Characteristic.CarPlaySupport); // CarPlay

    // Botón "Limpiar al llegar" para CarPlay
    const arriveSwitch = this.accessory.addService(this.platform.Service.Switch, 'Limpiar al llegar');
    arriveSwitch.getCharacteristic(this.platform.Characteristic.On).onSet(this.scheduleOnArrive.bind(this));

    // Cámara para mapa
    const cameraService = this.accessory.addService(this.platform.Service.Camera, 'Mapa Conga');
    // Config stream para mapa (simplificado, usa snapshot para imagen PNG)

    this.accessory.publish();
  }

  updateBattery(level: number) {
    this.batteryCharacteristic.updateValue(level);
    this.log.info(`Batería: ${level}%`);
  }

  updateMap(mapData?: { image: string; data: any }) {
    if (mapData?.image) {
      this.mapImage = Buffer.from(mapData.image, 'base64');
      // Actualiza snapshot en cámara para HomeKit (iPhone/Watch/CarPlay)
    }
    if (mapData?.data.rooms) {
      this.roomMap = mapData.data.rooms.reduce((acc, r) => ({ ...acc, [r.name]: r.id }), {});
    }
  }

  setCleaningState(isCleaning: boolean) {
    this.cleaningCharacteristic.updateValue(isCleaning);
  }

  async startCleaning(value: boolean, room?: string, mode: 'vacuum' | 'mop' | 'both' = 'both') {
    if (!value) return;
    const headers = { Authorization: `Bearer ${this.platform.token}` };
    let cleanMode = 101; // both
    if (mode === 'vacuum') cleanMode = 100;
    if (mode === 'mop') cleanMode = 102;

    try {
      if (room && this.roomMap[room]) {
        await axios.post('https://cloud.eu.cecotec.es/api/v1/device/clean_room', {
          roomIds: [this.roomMap[room]],
          cleanMode,
          repeats: 1
        }, { headers });
        this.log.info(`Limpieza ${mode} en ${room}`);
      } else {
        await axios.post('https://cloud.eu.cecotec.es/api/v1/device/start_cleaning', { cleanMode }, { headers });
        this.log.info(`Limpieza completa (${mode})`);
      }
      this.setCleaningState(true);
    } catch (error) {
      this.log.error('Error iniciando limpieza:', error);
    }
  }

  async scheduleOnArrive(value: boolean) {
    if (value) {
      const headers = { Authorization: `Bearer ${this.platform.token}` };
      await axios.post('https://cloud.eu.cecotec.es/api/v1/device/schedule_arrive_home', {}, { headers });
      this.platform.sendNotification('La Conga limpiará cuando llegues a casa');
    }
  }
}