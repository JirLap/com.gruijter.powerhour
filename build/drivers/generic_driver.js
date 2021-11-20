/*
Copyright 2019 - 2021, Robin de Gruijter (gruijter@hotmail.com)

This file is part of com.gruijter.powerhour.

com.gruijter.powerhour is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

com.gruijter.powerhour is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with com.gruijter.powerhour.  If not, see <http://www.gnu.org/licenses/>.s
*/

'use strict';

const { Driver } = require('homey');

const dailyResetApps = [
	'com.tibber',
	'it.diederik.solar',
];

class SumMeterDriver extends Driver {

	async onDriverInit() {
		this.log('onDriverInit');

		// add listener for hourly trigger
		if (this.eventListener) this.homey.removeListener('everyhour', this.eventListener);
		this.eventListener = async () => {
			const devices = this.getDevices();
			devices.forEach((device) => {
				const deviceName = device.getName();
				// check if source device exists
				const deviceExists = device.sourceDevice && device.sourceDevice.capabilitiesObj && (device.sourceDevice.available !== null);
				if (deviceExists) {
					// force immediate update
					device.pollMeter();
					// check if source device is available
					if (!device.sourceDevice.available) {
						this.error(`Source device ${deviceName} is unavailable.`);
						// device.setUnavailable('Source device is unavailable');
					} else device.setAvailable();
					// check if listener or polling is on, otherwise restart device
					const pollingOn = !!device.getSettings().interval && device.intervalIdDevicePoll
						&& (device.intervalIdDevicePoll._idleTimeout > 0);
					const listeningOn = Object.keys(device.capabilityInstances).length > 0;
					if (!pollingOn && !listeningOn) {
						this.error(`${deviceName} is not in polling or listening mode. Restarting now..`);
						device.restartDevice(1000);
					}
				} else {
					this.error(`Source device ${deviceName} is missing.`);
					device.setUnavailable('Source device is missing');
				}
			});
		};
		this.homey.on('everyhour', this.eventListener);
	}

	async onPairListDevices() {
		this.log('listing of devices started');
		return this.discoverDevices();
	}

	// stuff to find Homey devices
	async discoverDevices() {
		try {
			this.devices = [];
			const _devices = [];
			const allDevices = await this.homey.api.devices.getDevices();
			const keys = Object.keys(allDevices);
			keys.forEach((key) => {
				const hasCapability = (capability) => allDevices[key].capabilities.includes(capability);
				const found = this.ds.originDeviceCapabilities.some(hasCapability);
				if (found) {
					const device = {
						name: `${allDevices[key].name}_Σ${this.ds.driverId}`,
						data: {
							id: `PH_${this.ds.driverId}_${allDevices[key].id}`,
						},
						settings: {
							homey_device_id: allDevices[key].id,
							homey_device_name: allDevices[key].name,
							level: '3.0.0',
						},
						capabilities: this.ds.deviceCapabilities,
					};
					if (dailyResetApps.some((appId) => allDevices[key].driverUri.includes(appId))) {
						device.settings.homey_device_daily_reset = true;
					}
					_devices.push(device);
					this.devices = _devices.sort((a, b) => {
						if (a.name.toUpperCase() > b.name.toUpperCase()) return 1;
						return -1;
					});
					//this.log("Sorted:",this.devices)
				}
			});
			return Promise.resolve(this.devices);
		} catch (error) {
			return Promise.reject(error);
		}
	}

}

module.exports = SumMeterDriver;
