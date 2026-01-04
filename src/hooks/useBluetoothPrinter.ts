import { useState, useCallback } from 'react';

interface BluetoothPrinter {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  characteristic: BluetoothRemoteGATTCharacteristic;
}

export function useBluetoothPrinter() {
  const [printer, setPrinter] = useState<BluetoothPrinter | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.bluetooth) {
        throw new Error("Browser does not support Web Bluetooth");
      }

      console.log('Requesting Bluetooth Device...');
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }], // Standard printer service
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] 
        // Note: Some printers might use generic serial '00001101-0000-1000-8000-00805f9b34fb' but Web Bluetooth prefers GATT services.
        // We stick to 18f0 which is standard for many thermal printers over BLE.
      });

      console.log('Connecting to GATT Server...');
      if (!device.gatt) throw new Error("Device has no GATT server");
      
      const server = await device.gatt.connect();
      
      console.log('Getting Service...');
      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      
      console.log('Getting Characteristic...');
      // 2AF1 is commonly used for "Write" in 18F0 service
      const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

      setPrinter({ device, server, characteristic });
      setIsConnected(true);
      
      device.addEventListener('gattserverdisconnected', () => {
          setIsConnected(false);
          setPrinter(null);
      });

      return true;
    } catch (err: any) {
      console.error('Bluetooth Connect Error:', err);
      // Fallback for some generic printers if the above fails (Just logging advice)
      setError(err.message || "Failed to connect to printer");
      return false;
    }
  }, []);

  const print = useCallback(async (data: Uint8Array) => {
    if (!printer || !isConnected) {
      setError("Printer not connected");
      return;
    }

    setIsPrinting(true);
    setError(null);
    try {
      // BLE has a max packet size (MTU), usually 20-512 bytes. 
      // Safe chunk size is often around 512 for newer devices, or 20 for very old BLE.
      // We'll stick to 100 which is generally safe for intermediate devices, or we can try sending all if the browser handles fragmentation.
      // Chrome on Android usually handles fragmentation for WriteWithoutResponse, but safe to chunk manually if needed.
      const chunkSize = 512; 
      for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          await printer.characteristic.writeValue(chunk); 
      }
    } catch (err: any) {
      console.error('Printing Error:', err);
      setError(err.message || "Failed to print");
    } finally {
      setIsPrinting(false);
    }
  }, [printer, isConnected]);

  const disconnect = useCallback(() => {
     if (printer?.device.gatt?.connected) {
         printer.device.gatt.disconnect();
     }
     setPrinter(null);
     setIsConnected(false);
  }, [printer]);

  return {
    connect,
    disconnect,
    print,
    isConnected,
    isPrinting,
    error
  };
}
