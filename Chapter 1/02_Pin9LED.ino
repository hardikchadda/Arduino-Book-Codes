int ledPin = 9; // a nickname for pin 9

//telling Arduino Uno Eka R4 that we will be using pin 9 to send voltage signals
void setup(){
  pinMode(9, OUTPUT);
}
//blinking on loop just like before
void loop(){
  digitalWrite(ledPin, HIGH);  
  delay(1000);                    
  digitalWrite(ledPin, LOW); 
  delay(1000);                     
}