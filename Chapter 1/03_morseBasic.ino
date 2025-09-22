const int ledPin = 9;

void dot() { // defining the function for a short blink
  digitalWrite(ledPin, HIGH);
  delay(200); // 0.2 seconds on-time
  digitalWrite(ledPin, LOW);
  delay(200);
}

void dash() { // defining the function for a long blink
  digitalWrite(ledPin, HIGH);
  delay(600);  //0.6 seconds on-time
  digitalWrite(ledPin, LOW);
  delay(200);
}

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  // Calling the functions for S (dot dot dot)
  dot(); dot(); dot();
  delay(1000); // gap between letters

  // Calling the functions for O (dash dash dash)
  dash(); dash(); dash();
  delay(1000); // gap between letters

  // Calling the functions for S (dot dot dot)
  dot(); dot(); dot();
  delay(3000); // longer gap after word
}
