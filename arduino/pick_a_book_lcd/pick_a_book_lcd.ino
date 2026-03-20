/*
 * Pick-A-Book — Arduino 16x2 I2C LCD
 * Library: LiquidCrystal_I2C by Frank de Brabander
 * Wiring:  SDA→A4  SCL→A5  VCC→5V  GND→GND
 * If LCD is blank change 0x27 to 0x3F below.
 * Protocol from Flask:  LINE1|LINE2\n
 */
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

const unsigned long MSG_MS = 4000;
String inputBuf = "";
unsigned long shownAt  = 0;
bool showingMsg = false;

byte bookChar[8] = {0,0b11111,0b10001,0b10001,0b11111,0b10001,0b11111,0};

void setup() {
  Serial.begin(9600);
  lcd.init(); lcd.backlight();
  lcd.createChar(0, bookChar);
  lcd.setCursor(0,0); lcd.write(byte(0)); lcd.print(" Pick-A-Book");
  lcd.setCursor(0,1); lcd.print("  Loading...");
  delay(2000); showIdle();
}

void loop() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n') { processMsg(inputBuf); inputBuf=""; }
    else inputBuf += c;
  }
  if (showingMsg && millis()-shownAt >= MSG_MS) { showingMsg=false; showIdle(); }
}

void processMsg(String msg) {
  msg.trim(); if (!msg.length()) return;
  int sep = msg.indexOf('|');
  String l1 = sep>=0 ? msg.substring(0,sep)   : msg;
  String l2 = sep>=0 ? msg.substring(sep+1)   : "";
  if (l1.length()>16) l1=l1.substring(0,16);
  if (l2.length()>16) l2=l2.substring(0,16);
  lcd.clear();
  lcd.setCursor(0,0); lcd.print(l1);
  lcd.setCursor(0,1); lcd.print(l2);
  shownAt=millis(); showingMsg=true;
  Serial.print("ACK:"); Serial.println(msg);
}

void showIdle() {
  lcd.clear();
  lcd.setCursor(0,0); lcd.write(byte(0)); lcd.print(" Pick-A-Book");
  lcd.setCursor(0,1); lcd.print("Ready...");
}
