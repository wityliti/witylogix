import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import RoutesScreen from "../screens/RoutesScreen";
import RouteDetailScreen from "../screens/RouteDetailScreen";
import DeliveryScreen from "../screens/DeliveryScreen";
import ProfileScreen from "../screens/ProfileScreen";
const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const RoutesStack = createNativeStackNavigator();
const HomeStackNavigator = () => (
  <HomeStack.Navigator
    screenOptions={{
      headerShown: true,
      headerTintColor: "#005bd3",
    }}
  >
    <HomeStack.Screen
      name="HomeMain"
      component={HomeScreen}
      options={{ title: "Today" }}
    />
    <HomeStack.Screen
      name="Delivery"
      component={DeliveryScreen}
      options={{ title: "Delivery", headerBackTitle: "Back" }}
    />
  </HomeStack.Navigator>
);
const RoutesStackNavigator = () => (
  <RoutesStack.Navigator
    screenOptions={{
      headerShown: true,
      headerTintColor: "#005bd3",
    }}
  >
    <RoutesStack.Screen
      name="RoutesList"
      component={RoutesScreen}
      options={{ title: "Routes" }}
    />
    <RoutesStack.Screen
      name="RouteDetail"
      component={RouteDetailScreen}
      options={{ title: "Route Details", headerBackTitle: "Back" }}
    />
  </RoutesStack.Navigator>
);
const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#005bd3",
        tabBarInactiveTintColor: "#666",
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          title: "Today",
          tabBarLabel: "Today",
        }}
      />
      <Tab.Screen
        name="Routes"
        component={RoutesStackNavigator}
        options={{
          title: "Routes",
          tabBarLabel: "Routes",
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Profile",
          tabBarLabel: "Profile",
        }}
      />
    </Tab.Navigator>
  );
};
export default MainTabs;
//# sourceMappingURL=MainTabs.js.map
